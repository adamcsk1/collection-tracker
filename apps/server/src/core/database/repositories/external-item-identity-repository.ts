import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import {
  ExternalItemIdentityModel,
  ExternalItemIdentitySourceNameModel,
} from '@shared/models/external-metadata-provider-model';
import Database from 'better-sqlite3';
import { ExternalIdentityRow } from './external-item-identity-model';

const IDENTITY_LOOKUP_CHUNK_SIZE = 400;

const normalizeIdentitySource = (source: string): ExternalItemIdentitySourceNameModel | null => {
  const normalizedSource = source.trim().toLowerCase();
  return isExternalItemIdentitySourceName(normalizedSource) ? normalizedSource : null;
};
const normalizeIdentityId = (source: ExternalItemIdentitySourceNameModel, id: string): string =>
  source === 'imdb' ? id.trim().toLowerCase() : id.trim();

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
  if (/^tt\d+$/i.test(identityId.trim())) addIdentity('imdb', identityId);
  for (const externalId of externalIds) {
    addIdentity(externalId.source, externalId.id);
    if (/^tt\d+$/i.test(externalId.id.trim())) addIdentity('imdb', externalId.id);
  }

  return [...identities.values()];
};

export const inferCanonicalItemId = (identities: ExternalItemIdentityModel[]): string => {
  const imdbIdentity = identities.find((identity) => identity.source === 'imdb' && /^tt\d+$/i.test(identity.id));
  if (imdbIdentity) return `imdb:${imdbIdentity.id.toLowerCase()}`;
  const primaryIdentity = identities[0];
  return `${primaryIdentity.source}:${primaryIdentity.id}`;
};

const findImdbCanonicalItemId = (identities: ExternalItemIdentityModel[]): string | null => {
  const imdbIdentity = identities.find((identity) => identity.source === 'imdb' && /^tt\d+$/i.test(identity.id));
  return imdbIdentity ? `imdb:${imdbIdentity.id.toLowerCase()}` : null;
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
  for (const identity of identities) {
    const row = db
      .prepare(
        `SELECT canonical_item_id
         FROM external_item_identities
         WHERE username_hash = ? AND external_provider = ? AND external_item_id = ?`
      )
      .get(usernameHash, identity.source, identity.id) as ExternalIdentityRow | undefined;
    if (row?.canonical_item_id) return row.canonical_item_id;
  }

  const imdbCanonicalItemId = findImdbCanonicalItemId(identities);
  if (imdbCanonicalItemId) return imdbCanonicalItemId;

  return inferCanonicalItemId(identities);
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
    if (identity.source === 'imdb' && /^tt\d+$/i.test(identity.id)) {
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
      if (identity.source === 'imdb' && /^tt\d+$/i.test(identity.id)) {
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
  const statement = db.prepare(
    `INSERT INTO external_item_identities
      (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(username_hash, external_provider, external_item_id) DO UPDATE SET
       canonical_item_id = excluded.canonical_item_id,
       source_confidence = excluded.source_confidence
     WHERE external_item_identities.source_confidence = 'primary'`
  );

  for (const identity of identities) {
    const existingRow = db
      .prepare(
        `SELECT canonical_item_id, source_confidence
         FROM external_item_identities
         WHERE username_hash = ? AND external_provider = ? AND external_item_id = ?`
      )
      .get(usernameHash, identity.source, identity.id) as ExternalIdentityRow | undefined;
    statement.run(
      usernameHash,
      canonicalItemId,
      identity.source,
      identity.id,
      identity.source === externalProvider ? 'primary' : 'alias'
    );
    if (existingRow?.source_confidence === 'primary' && existingRow.canonical_item_id !== canonicalItemId) {
      db.prepare(
        'UPDATE collection_items SET canonical_item_id = ? WHERE username_hash = ? AND canonical_item_id = ?'
      ).run(canonicalItemId, usernameHash, existingRow.canonical_item_id);
      db.prepare(
        `UPDATE external_item_identities
         SET canonical_item_id = ?
         WHERE username_hash = ? AND canonical_item_id = ? AND source_confidence = 'primary'`
      ).run(canonicalItemId, usernameHash, existingRow.canonical_item_id);
    }
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
