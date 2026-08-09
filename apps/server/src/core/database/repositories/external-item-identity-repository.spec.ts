import { describe, expect, it } from 'vitest';
import { getDatabase } from '../database';
import {
  deleteExternalItemIdentitiesForCanonicalItemId,
  findExternalItemIdentitiesByCanonicalItemId,
  normalizeExternalIdentities,
  resolveCanonicalItemId,
  resolveCanonicalItemIds,
  resolveCanonicalItemIdsForIdentities,
  upsertExternalItemIdentities,
} from './external-item-identity-repository';

const insertUser = (usernameHash: string): void => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (usernameHash: string, canonicalItemId: string): void => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, contributors, description, image, content_hash)
       VALUES (?, ?, ?, ?, 'library', 'Title', 'title', '2024', '', 'Plot', 'image', ?)`
    )
    .run(usernameHash, 'omdb', canonicalItemId.replace(/^imdb:/, ''), canonicalItemId, canonicalItemId);
};

describe('external-item-identity-repository', () => {
  it('normalizes providers, IMDb ids, and tt-shaped ids for every source without forcing non-tt provider ids onto imdb', () => {
    expect(
      normalizeExternalIdentities(' OMDB ', ' TT0133093 ', [
        { source: 'imdb', id: 'TT0133093' },
        { source: 'omdb', id: 'TT0133093' },
      ])
    ).toEqual([
      { source: 'omdb', id: 'tt0133093' },
      { source: 'imdb', id: 'tt0133093' },
    ]);
    expect(normalizeExternalIdentities('omdb', 'tt0133093')).toEqual([
      { source: 'omdb', id: 'tt0133093' },
      { source: 'imdb', id: 'tt0133093' },
    ]);
    expect(normalizeExternalIdentities('omdb', '603')).toEqual([{ source: 'omdb', id: '603' }]);
  });

  it('ignores unknown providers and blank ids when normalizing', () => {
    expect(
      normalizeExternalIdentities('tmdb', '603', [
        { source: 'imdb', id: '  ' },
        { source: 'imdb', id: ' TT0133093 ' },
      ])
    ).toEqual([{ source: 'imdb', id: 'tt0133093' }]);
  });

  it('rejects canonical resolution for unknown providers without known aliases', () => {
    const db = getDatabase();

    expect(() => resolveCanonicalItemId(db, 'user', 'tmdb', '603')).toThrow('External provider is not supported');
    expect(resolveCanonicalItemIds(db, 'user', 'tmdb', '603')).toEqual([]);
  });

  it('resolves an existing user-scoped canonical mapping before equal-strength inferred identities', () => {
    const db = getDatabase();
    insertUser('user-a');
    insertUser('user-b');
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user-a', 'imdb:tt9999999', 'imdb', 'tt0133093', 'alias');

    expect(resolveCanonicalItemId(db, 'user-a', 'omdb', 'tt0133093')).toBe('imdb:tt9999999');
    expect(resolveCanonicalItemId(db, 'user-b', 'omdb', 'tt0133093')).toBe('imdb:tt0133093');
  });

  it('prefers stronger inferred imdb canonical over a weaker stored mapping', () => {
    const db = getDatabase();
    insertUser('user');
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'omdb:temporary', 'omdb', 'temporary', 'primary');

    expect(resolveCanonicalItemId(db, 'user', 'omdb', 'temporary', [{ source: 'imdb', id: 'tt0133093' }])).toBe(
      'imdb:tt0133093'
    );
  });

  it('returns all mapped and inferred canonical candidates', () => {
    const db = getDatabase();
    insertUser('user');
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'imdb:tt9999999', 'imdb', 'tt0133093', 'alias');

    expect(resolveCanonicalItemIds(db, 'user', 'omdb', 'tt0133093')).toEqual(['imdb:tt9999999', 'imdb:tt0133093']);
  });

  it('resolves identity batches with mapped candidates before caller-ordered inferred candidates', () => {
    const db = getDatabase();
    insertUser('user');
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'imdb:tt9999999', 'omdb', 'custom-id', 'alias');

    expect(
      resolveCanonicalItemIdsForIdentities(db, 'user', [
        { source: 'omdb', id: 'custom-id' },
        { source: 'imdb', id: 'TT0133093' },
      ])
    ).toEqual(['imdb:tt9999999', 'omdb:custom-id', 'imdb:tt0133093']);
  });

  it('resolves mapped candidates from identity batches larger than the former bind chunk', () => {
    const db = getDatabase();
    insertUser('user');
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'imdb:tt9999999', 'omdb', 'custom-449', 'alias');

    const canonicalItemIds = resolveCanonicalItemIdsForIdentities(
      db,
      'user',
      Array.from({ length: 450 }, (_, index) => ({ source: 'omdb' as const, id: `custom-${index}` }))
    );

    expect(canonicalItemIds).toContain('imdb:tt9999999');
  });

  it('falls back to provider-scoped canonical ids when no IMDb identity exists', () => {
    expect(resolveCanonicalItemId(getDatabase(), 'user', 'omdb', 'custom-id')).toBe('omdb:custom-id');
  });

  it('normalizes ISBN variants and infers ISBN canonical identities', () => {
    expect(normalizeExternalIdentities('openlibrary', '0-306-40615-2')).toEqual([
      { source: 'openlibrary', id: '9780306406157' },
      { source: 'isbn', id: '9780306406157' },
    ]);
    expect(resolveCanonicalItemId(getDatabase(), 'user', 'isbn', '978-0-306-40615-7')).toBe('isbn:9780306406157');
    expect(resolveCanonicalItemIds(getDatabase(), 'user', 'openlibrary', '0-306-40615-2')).toEqual([
      'isbn:9780306406157',
    ]);
  });

  it('infers imdb canonical ids from tt-shaped provider ids without externalIds', () => {
    expect(resolveCanonicalItemId(getDatabase(), 'user', 'omdb', 'tt0133093')).toBe('imdb:tt0133093');
  });

  it('upserts primary and alias identity mappings', () => {
    const db = getDatabase();
    insertUser('user');

    upsertExternalItemIdentities(db, 'user', 'imdb:tt0133093', 'omdb', 'tt0133093', [
      { source: 'imdb', id: 'tt0133093' },
    ]);

    expect(
      db
        .prepare(
          `SELECT canonical_item_id, external_provider, external_item_id, source_confidence
           FROM external_item_identities
           WHERE username_hash = ?
           ORDER BY external_provider`
        )
        .all('user')
    ).toEqual([
      {
        canonical_item_id: 'imdb:tt0133093',
        external_provider: 'imdb',
        external_item_id: 'tt0133093',
        source_confidence: 'alias',
      },
      {
        canonical_item_id: 'imdb:tt0133093',
        external_provider: 'omdb',
        external_item_id: 'tt0133093',
        source_confidence: 'primary',
      },
    ]);
  });

  it('merges primary mappings into upgraded alias canonical ids', () => {
    const db = getDatabase();
    insertUser('user');
    insertItem('user', 'omdb:temporary');
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'omdb:temporary', 'omdb', 'temporary', 'primary');

    upsertExternalItemIdentities(db, 'user', 'imdb:tt0133093', 'omdb', 'temporary', [
      { source: 'imdb', id: 'tt0133093' },
    ]);

    expect(db.prepare('SELECT canonical_item_id FROM collection_items WHERE username_hash = ?').get('user')).toEqual({
      canonical_item_id: 'imdb:tt0133093',
    });
    expect(resolveCanonicalItemId(db, 'user', 'omdb', 'temporary')).toBe('imdb:tt0133093');
  });

  it('rewrites all identities under a weaker canonical when a stronger imdb canonical arrives', () => {
    const db = getDatabase();
    insertUser('user');
    insertItem('user', 'omdb:temporary');
    const statement = db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    );
    statement.run('user', 'omdb:temporary', 'omdb', 'temporary', 'primary');
    statement.run('user', 'omdb:temporary', 'imdb', 'tt0000001', 'alias');

    upsertExternalItemIdentities(db, 'user', 'imdb:tt0133093', 'omdb', 'temporary', [
      { source: 'imdb', id: 'tt0133093' },
    ]);

    expect(
      db
        .prepare(
          `SELECT canonical_item_id, external_provider, external_item_id, source_confidence
           FROM external_item_identities
           WHERE username_hash = ?
           ORDER BY external_provider, external_item_id`
        )
        .all('user')
    ).toEqual([
      {
        canonical_item_id: 'imdb:tt0133093',
        external_provider: 'imdb',
        external_item_id: 'tt0000001',
        source_confidence: 'alias',
      },
      {
        canonical_item_id: 'imdb:tt0133093',
        external_provider: 'imdb',
        external_item_id: 'tt0133093',
        source_confidence: 'alias',
      },
      {
        canonical_item_id: 'imdb:tt0133093',
        external_provider: 'omdb',
        external_item_id: 'temporary',
        source_confidence: 'primary',
      },
    ]);
  });

  it('throws when merging canonicals would collide on the same list type', () => {
    const db = getDatabase();
    insertUser('user');
    insertItem('user', 'omdb:temporary');
    insertItem('user', 'imdb:tt0133093');
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'omdb:temporary', 'omdb', 'temporary', 'primary');
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'imdb:tt0133093', 'imdb', 'tt0133093', 'alias');

    expect(() =>
      upsertExternalItemIdentities(db, 'user', 'imdb:tt0133093', 'omdb', 'temporary', [
        { source: 'imdb', id: 'tt0133093' },
      ])
    ).toThrow(/Canonical merge collision/);
  });

  it('keeps a stronger imdb canonical when a weaker provider-scoped canonical is written', () => {
    const db = getDatabase();
    insertUser('user');
    insertItem('user', 'imdb:tt0133093');
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'imdb:tt0133093', 'omdb', 'temporary', 'primary');
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'imdb:tt0133093', 'imdb', 'tt0133093', 'alias');

    upsertExternalItemIdentities(db, 'user', 'omdb:temporary', 'omdb', 'temporary', [
      { source: 'imdb', id: 'tt0133093' },
    ]);

    expect(db.prepare('SELECT canonical_item_id FROM collection_items WHERE username_hash = ?').get('user')).toEqual({
      canonical_item_id: 'imdb:tt0133093',
    });
    expect(resolveCanonicalItemId(db, 'user', 'omdb', 'temporary')).toBe('imdb:tt0133093');
  });

  it('finds identities for a canonical id in stable order and scoped to the user', () => {
    const db = getDatabase();
    insertUser('user-a');
    insertUser('user-b');
    const statement = db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    );
    statement.run('user-a', 'imdb:tt0133093', 'omdb', 'tt0133093', 'primary');
    statement.run('user-a', 'imdb:tt0133093', 'imdb', 'tt0133093', 'alias');
    statement.run('user-b', 'imdb:tt0133093', 'imdb', 'tt0000001', 'alias');

    expect(findExternalItemIdentitiesByCanonicalItemId(db, 'user-a', 'imdb:tt0133093')).toEqual([
      { source: 'imdb', id: 'tt0133093' },
      { source: 'omdb', id: 'tt0133093' },
    ]);
  });

  it('deletes identities for a canonical id scoped to the user', () => {
    const db = getDatabase();
    insertUser('user-a');
    insertUser('user-b');
    const statement = db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    );
    statement.run('user-a', 'imdb:tt0133093', 'omdb', 'tt0133093', 'primary');
    statement.run('user-a', 'imdb:tt0133093', 'imdb', 'tt0133093', 'alias');
    statement.run('user-b', 'imdb:tt0133093', 'imdb', 'tt0133093', 'alias');
    statement.run('user-a', 'imdb:tt0000001', 'imdb', 'tt0000001', 'alias');

    deleteExternalItemIdentitiesForCanonicalItemId(db, 'user-a', 'imdb:tt0133093');

    expect(
      db
        .prepare(
          `SELECT username_hash, canonical_item_id, external_provider, external_item_id
           FROM external_item_identities
           ORDER BY username_hash, canonical_item_id, external_provider`
        )
        .all()
    ).toEqual([
      {
        username_hash: 'user-a',
        canonical_item_id: 'imdb:tt0000001',
        external_provider: 'imdb',
        external_item_id: 'tt0000001',
      },
      {
        username_hash: 'user-b',
        canonical_item_id: 'imdb:tt0133093',
        external_provider: 'imdb',
        external_item_id: 'tt0133093',
      },
    ]);
  });
});
