import { CollectionItemFiltersApiModel } from '@shared/models/api-model';
import { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface CollectionCursorPayload {
  version: 1;
  kind: 'collection';
  sortValue: string;
  rowId: number;
  filterHash: string;
}

export interface MatchesCursorPayload {
  version: 1;
  kind: 'matches';
  rank: number;
  rowId: number;
  filterHash: string;
}

export type CursorPayload = CollectionCursorPayload | MatchesCursorPayload;

export class CursorValidationError extends Error {}

const MAX_CURSOR_LENGTH = 4096;

export const isCursorToken = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_CURSOR_LENGTH;

const getSecret = (): string => {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) throw new Error('COOKIE_SECRET is required for cursor signing');
  return secret;
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
      .map(([key, entryValue]) => [key, stableValue(entryValue)])
  );
};

const normalizeFilters = (filters: CollectionItemFiltersApiModel | undefined): Record<string, unknown> => ({
  search: filters?.search?.trim().toLowerCase() ?? '',
  tags: (filters?.tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .sort(),
  genres: (filters?.genres ?? [])
    .map((genre) => genre.trim().toLowerCase())
    .filter(Boolean)
    .sort(),
  tagMode: filters?.tagMode ?? 'any',
  type: filters?.type ?? null,
  watched: filters?.watched ?? null,
  completed: filters?.completed ?? null,
  favorite: filters?.favorite ?? null,
  shared: filters?.shared ?? null,
  listType: filters?.listType ?? 'library',
  orderBy: filters?.orderBy ?? 'createdAt',
  orderDirection: filters?.orderDirection ?? 'desc',
});

export const createCollectionFilterHash = (
  viewerUsernameHash: string,
  filters: CollectionItemFiltersApiModel | undefined,
  identities?: ExternalItemIdentityModel[]
): string =>
  createHash('sha256')
    .update(
      JSON.stringify(
        stableValue({
          viewerUsernameHash,
          filters: normalizeFilters(filters),
          identities: identities?.map(({ source, id }) => ({ source, id })),
        })
      )
    )
    .digest('base64url');

export const encodeCursor = (payload: CursorPayload, secret = getSecret()): string => {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
};

export const decodeCursor = <Kind extends CursorPayload['kind']>(
  token: string,
  kind: Kind,
  filterHash: string,
  secret = getSecret()
): Extract<CursorPayload, { kind: Kind }> => {
  try {
    if (token.length > MAX_CURSOR_LENGTH) throw new CursorValidationError();
    const [encodedPayload, encodedSignature, extraPart] = token.split('.');
    if (!encodedPayload || !encodedSignature || extraPart !== undefined) throw new CursorValidationError();

    const actualSignature = Buffer.from(encodedSignature, 'base64url');
    const expectedSignature = createHmac('sha256', secret).update(encodedPayload).digest();
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
      throw new CursorValidationError();
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    const commonValid = payload.version === 1 && payload.kind === kind && payload.filterHash === filterHash;
    const kindValid =
      (kind === 'collection' &&
        typeof (payload as Partial<CollectionCursorPayload>).sortValue === 'string' &&
        Number.isSafeInteger((payload as Partial<CollectionCursorPayload>).rowId) &&
        Number((payload as Partial<CollectionCursorPayload>).rowId) > 0) ||
      (kind === 'matches' &&
        Number.isSafeInteger((payload as Partial<MatchesCursorPayload>).rank) &&
        Number((payload as Partial<MatchesCursorPayload>).rank) >= 0 &&
        Number.isSafeInteger((payload as Partial<MatchesCursorPayload>).rowId) &&
        Number((payload as Partial<MatchesCursorPayload>).rowId) > 0);
    if (!commonValid || !kindValid) throw new CursorValidationError();
    return payload as Extract<CursorPayload, { kind: Kind }>;
  } catch (error) {
    if (error instanceof CursorValidationError) throw error;
    throw new CursorValidationError();
  }
};
