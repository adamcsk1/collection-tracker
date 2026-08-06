import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import {
  ExternalItemIdentityModel,
  ExternalItemIdentitySourceNameModel,
} from '@shared/models/external-metadata-provider-model';
import Database from 'better-sqlite3';
import { normalizeIsbn13 } from '../../utils/isbn-util';
import { ExternalIdentityRow } from './external-item-identity-model';

const IDENTITY_LOOKUP_CHUNK_SIZE = 400;
const IMDB_SHAPED_ID = /^tt\d+$/i;

const normalizeIdentitySource = (source: string): ExternalItemIdentitySourceNameModel | null => {
  const normalizedSource = source.trim().toLowerCase();
  return isExternalItemIdentitySourceName(normalizedSource) ? normalizedSource : null;
};

const normalizeIdentityId = (source: ExternalItemIdentitySourceNameModel, id: string): string => {
  const trimmedId = id.trim();
  if (source === 'imdb' || IMDB_SHAPED_ID.test(trimmedId)) return trimmedId.toLowerCase();
  if (source === 'isbn' || source === 'openlibrary') return normalizeIsbn13(id) ?? '';
  return trimmedId;
};

export const normalizeExternalIdentities = (
  identitySource: string,
  identityId: string,
  externalIds: Array<{ source: string; id: string }> = []
): ExternalItemIdentityModel[] => {
  const identities = new Map<string, ExternalItemIdentityModel>();
  const addIdentity = (source: unknown, id: unknown): void => {
    if (typeof source !== 'string' || typeof id !== 'string') return;
    const normalizedSource = normalizeIdentitySource(source);
    if (!normalizedSource) return;
    const normalizedId = normalizeIdentityId(normalizedSource, id);
    if (!normalizedSource || !normalizedId) return;
    identities.set(`${normalizedSource}\u0000${normalizedId}`, { source: normalizedSource, id: normalizedId });
  };

  addIdentity(identitySource, identityId);
  if (normalizeIdentitySource(identitySource) === 'openlibrary') addIdentity('isbn', identityId);
  if (IMDB_SHAPED_ID.test(identityId.trim())) addIdentity('imdb', identityId);
  for (const externalId of externalIds) {
    addIdentity(externalId.source, externalId.id);
    if (normalizeIdentitySource(externalId.source) === 'openlibrary') addIdentity('isbn', externalId.id);
    if (IMDB_SHAPED_ID.test(externalId.id.trim())) addIdentity('imdb', externalId.id);
  }

  return [...identities.values()];
};

export const inferCanonicalItemId = (identities: ExternalItemIdentityModel[]): string => {
  const imdbIdentity = identities.find((identity) => identity.source === 'imdb' && IMDB_SHAPED_ID.test(identity.id));
  if (imdbIdentity) return `imdb:${imdbIdentity.id.toLowerCase()}`;
  const isbnIdentity = identities.find((identity) => identity.source === 'isbn');
  if (isbnIdentity) return `isbn:${isbnIdentity.id}`;
  const primaryIdentity = identities[0];
  return `${primaryIdentity.source}:${primaryIdentity.id}`;
};

/** Higher = stronger. imdb:tt… > isbn:… > provider-scoped. */
export const getCanonicalItemIdStrength = (canonicalItemId: string): number => {
  if (/^imdb:tt\d+$/i.test(canonicalItemId)) return 3;
  if (canonicalItemId.startsWith('isbn:') && canonicalItemId.length > 5) return 2;
  if (canonicalItemId.includes(':') && !canonicalItemId.startsWith(':') && !canonicalItemId.endsWith(':')) return 1;
  return 0;
};

export const pickStrongerCanonicalItemId = (left: string, right: string): string => {
  const leftStrength = getCanonicalItemIdStrength(left);
  const rightStrength = getCanonicalItemIdStrength(right);
  if (rightStrength > leftStrength) return right;
  return left;
};

const hasCanonicalMergeCollision = (
  db: Database.Database,
  usernameHash: string,
  fromCanonicalItemId: string,
  toCanonicalItemId: string
): boolean => {
  const collision = db
    .prepare(
      `SELECT 1
       FROM collection_items source_item
       WHERE source_item.username_hash = ?
         AND source_item.canonical_item_id = ?
         AND EXISTS (
           SELECT 1
           FROM collection_items target_item
           WHERE target_item.username_hash = source_item.username_hash
             AND target_item.canonical_item_id = ?
             AND target_item.list_type = source_item.list_type
         )
       LIMIT 1`
    )
    .get(usernameHash, fromCanonicalItemId, toCanonicalItemId);
  return Boolean(collision);
};

const rewriteCanonicalItemId = (
  db: Database.Database,
  usernameHash: string,
  fromCanonicalItemId: string,
  toCanonicalItemId: string
): void => {
  if (fromCanonicalItemId === toCanonicalItemId) return;
  if (hasCanonicalMergeCollision(db, usernameHash, fromCanonicalItemId, toCanonicalItemId)) {
    throw new Error(`Canonical merge collision for ${usernameHash}: ${fromCanonicalItemId} -> ${toCanonicalItemId}`);
  }
  db.prepare('UPDATE collection_items SET canonical_item_id = ? WHERE username_hash = ? AND canonical_item_id = ?').run(
    toCanonicalItemId,
    usernameHash,
    fromCanonicalItemId
  );
  db.prepare(
    `UPDATE external_item_identities
     SET canonical_item_id = ?
     WHERE username_hash = ? AND canonical_item_id = ?`
  ).run(toCanonicalItemId, usernameHash, fromCanonicalItemId);
};

export const resolveCanonicalItemId = (
  db: Database.Database,
  usernameHash: string,
  identitySource: string,
  identityId: string,
  externalIds: ExternalItemIdentityModel[] = []
): string => {
  const identities = normalizeExternalIdentities(identitySource, identityId, externalIds);
  if (identities.length === 0) throw new Error('External provider is not supported');
  let resolvedCanonicalItemId: string | undefined;
  for (const identity of identities) {
    const row = db
      .prepare(
        `SELECT canonical_item_id
         FROM external_item_identities
         WHERE username_hash = ? AND external_provider = ? AND external_item_id = ?`
      )
      .get(usernameHash, identity.source, identity.id) as ExternalIdentityRow | undefined;
    if (row?.canonical_item_id) {
      resolvedCanonicalItemId = resolvedCanonicalItemId
        ? pickStrongerCanonicalItemId(resolvedCanonicalItemId, row.canonical_item_id)
        : row.canonical_item_id;
    }
  }
  const inferredCanonicalItemId = inferCanonicalItemId(identities);
  if (resolvedCanonicalItemId) {
    return pickStrongerCanonicalItemId(resolvedCanonicalItemId, inferredCanonicalItemId);
  }
  return inferredCanonicalItemId;
};

export const resolveCanonicalItemIds = (
  db: Database.Database,
  usernameHash: string,
  identitySource: string,
  identityId: string,
  externalIds: ExternalItemIdentityModel[] = []
): string[] => {
  const identities = normalizeExternalIdentities(identitySource, identityId, externalIds);
  if (identities.length === 0) return [];
  const canonicalItemIds = new Set<string>();
  for (const identity of identities) {
    const row = db
      .prepare(
        `SELECT canonical_item_id
         FROM external_item_identities
         WHERE username_hash = ? AND external_provider = ? AND external_item_id = ?`
      )
      .get(usernameHash, identity.source, identity.id) as ExternalIdentityRow | undefined;
    if (row?.canonical_item_id) canonicalItemIds.add(row.canonical_item_id);
  }

  for (const identity of identities) {
    if (identity.source === 'imdb' && IMDB_SHAPED_ID.test(identity.id)) {
      canonicalItemIds.add(`imdb:${identity.id.toLowerCase()}`);
    }
  }
  canonicalItemIds.add(inferCanonicalItemId(identities));

  return [...canonicalItemIds];
};

export const resolveCanonicalItemIdsForIdentities = (
  db: Database.Database,
  usernameHash: string,
  identities: ExternalItemIdentityModel[]
): string[] => {
  const normalizedIdentityGroups = identities.map((identity) =>
    normalizeExternalIdentities(identity.source, identity.id)
  );
  const identityIdsBySource = new Map<ExternalItemIdentitySourceNameModel, Set<string>>();
  for (const normalizedIdentities of normalizedIdentityGroups) {
    for (const identity of normalizedIdentities) {
      const identityIds = identityIdsBySource.get(identity.source) ?? new Set<string>();
      identityIds.add(identity.id);
      identityIdsBySource.set(identity.source, identityIds);
    }
  }

  const mappedCanonicalItemIds = new Map<string, string>();
  for (const [source, identityIdSet] of identityIdsBySource) {
    const identityIds = [...identityIdSet];
    for (let identityIndex = 0; identityIndex < identityIds.length; identityIndex += IDENTITY_LOOKUP_CHUNK_SIZE) {
      const identityIdChunk = identityIds.slice(identityIndex, identityIndex + IDENTITY_LOOKUP_CHUNK_SIZE);
      const rows = db
        .prepare(
          `SELECT canonical_item_id, external_provider, external_item_id
           FROM external_item_identities
           WHERE username_hash = ?
             AND external_provider = ?
             AND external_item_id IN (${identityIdChunk.map(() => '?').join(', ')})`
        )
        .all(usernameHash, source, ...identityIdChunk) as ExternalIdentityRow[];
      for (const row of rows) {
        mappedCanonicalItemIds.set(`${row.external_provider}\u0000${row.external_item_id}`, row.canonical_item_id);
      }
    }
  }

  const canonicalItemIds = new Set<string>();
  for (const normalizedIdentities of normalizedIdentityGroups) {
    for (const identity of normalizedIdentities) {
      const mappedCanonicalItemId = mappedCanonicalItemIds.get(`${identity.source}\u0000${identity.id}`);
      if (mappedCanonicalItemId) canonicalItemIds.add(mappedCanonicalItemId);
    }
    for (const identity of normalizedIdentities) {
      if (identity.source === 'imdb' && IMDB_SHAPED_ID.test(identity.id)) {
        canonicalItemIds.add(`imdb:${identity.id.toLowerCase()}`);
      }
    }
    if (normalizedIdentities.length) canonicalItemIds.add(inferCanonicalItemId(normalizedIdentities));
  }

  return [...canonicalItemIds];
};

export const upsertExternalItemIdentities = (
  db: Database.Database,
  usernameHash: string,
  canonicalItemId: string,
  externalProvider: string,
  externalItemId: string,
  externalIds: ExternalItemIdentityModel[] = []
): void => {
  const identities = normalizeExternalIdentities(externalProvider, externalItemId, externalIds);
  if (identities.length === 0) return;

  let targetCanonicalItemId = canonicalItemId;
  const existingCanonicalItemIds = new Set<string>();
  for (const identity of identities) {
    const existingRow = db
      .prepare(
        `SELECT canonical_item_id, source_confidence
         FROM external_item_identities
         WHERE username_hash = ? AND external_provider = ? AND external_item_id = ?`
      )
      .get(usernameHash, identity.source, identity.id) as ExternalIdentityRow | undefined;
    if (existingRow?.canonical_item_id) {
      existingCanonicalItemIds.add(existingRow.canonical_item_id);
      targetCanonicalItemId = pickStrongerCanonicalItemId(targetCanonicalItemId, existingRow.canonical_item_id);
    }
  }
  targetCanonicalItemId = pickStrongerCanonicalItemId(targetCanonicalItemId, inferCanonicalItemId(identities));

  for (const existingCanonicalItemId of existingCanonicalItemIds) {
    if (existingCanonicalItemId === targetCanonicalItemId) continue;
    if (pickStrongerCanonicalItemId(existingCanonicalItemId, targetCanonicalItemId) === targetCanonicalItemId) {
      rewriteCanonicalItemId(db, usernameHash, existingCanonicalItemId, targetCanonicalItemId);
    }
  }

  const statement = db.prepare(
    `INSERT INTO external_item_identities
      (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(username_hash, external_provider, external_item_id) DO UPDATE SET
       canonical_item_id = excluded.canonical_item_id,
       source_confidence = CASE
         WHEN excluded.source_confidence = 'primary' THEN excluded.source_confidence
         ELSE external_item_identities.source_confidence
       END`
  );

  for (const identity of identities) {
    statement.run(
      usernameHash,
      targetCanonicalItemId,
      identity.source,
      identity.id,
      identity.source === externalProvider ? 'primary' : 'alias'
    );
  }
};

export const deleteExternalItemIdentitiesForCanonicalItemId = (
  db: Database.Database,
  usernameHash: string,
  canonicalItemId: string | null
): void => {
  if (!canonicalItemId) return;
  db.prepare('DELETE FROM external_item_identities WHERE username_hash = ? AND canonical_item_id = ?').run(
    usernameHash,
    canonicalItemId
  );
};

export const deleteUnreferencedExternalItemIdentities = (
  db: Database.Database,
  usernameHash: string,
  canonicalItemIds: Array<string | null>
): void => {
  const uniqueCanonicalItemIds = [...new Set(canonicalItemIds.filter((canonicalItemId) => canonicalItemId !== null))];
  for (const canonicalItemId of uniqueCanonicalItemIds) {
    const row = db
      .prepare('SELECT COUNT(*) AS count FROM collection_items WHERE username_hash = ? AND canonical_item_id = ?')
      .get(usernameHash, canonicalItemId) as { count: number };
    if (row.count === 0) deleteExternalItemIdentitiesForCanonicalItemId(db, usernameHash, canonicalItemId);
  }
};

export const findExternalItemIdentitiesByCanonicalItemId = (
  db: Database.Database,
  usernameHash: string,
  canonicalItemId: string
): ExternalItemIdentityModel[] => {
  const rows = db
    .prepare(
      `SELECT external_provider, external_item_id
       FROM external_item_identities
       WHERE username_hash = ? AND canonical_item_id = ?
       ORDER BY external_provider, external_item_id`
    )
    .all(usernameHash, canonicalItemId) as ExternalIdentityRow[];
  return rows.flatMap((row) =>
    isExternalItemIdentitySourceName(row.external_provider)
      ? [{ source: row.external_provider, id: row.external_item_id }]
      : []
  );
};
