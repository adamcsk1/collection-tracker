import { describe, expect, it } from 'vitest';
import { getDatabase } from '../../database';
import { buildReadableItemScope } from './collection-query';

const insertUser = (usernameHash: string): void => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertItem = (
  usernameHash: string,
  externalItemId: string,
  listType: 'library' | 'books',
  contentType: 'movie' | 'series' | 'book'
): void => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, list_type, title, title_lower, year, contributors,
         description, image, content_hash, content_type)
       VALUES (?, 'imdb', ?, ?, ?, ?, '', '', '', '', ?, ?)`
    )
    .run(
      usernameHash,
      externalItemId,
      listType,
      externalItemId,
      externalItemId,
      `${usernameHash}-${externalItemId}`,
      contentType
    );
};

const insertGrant = (
  ownerUsernameHash: string,
  listType: 'library' | 'books',
  contentType: 'movie' | 'series' | 'book',
  canRead: 0 | 1
): void => {
  const db = getDatabase();
  db.prepare(
    `INSERT OR IGNORE INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, 'viewer')`
  ).run(ownerUsernameHash);
  db.prepare(
    `INSERT INTO user_share_grants
        (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read)
       VALUES (?, 'viewer', ?, ?, ?)`
  ).run(ownerUsernameHash, listType, contentType, canRead);
};

const selectReadableIds = (shared?: 'mine' | 'shared', type?: 'movie' | 'series' | 'book'): string[] => {
  const scope = buildReadableItemScope('viewer', { shared, type });
  return (
    getDatabase()
      .prepare(
        `SELECT external_item_id FROM collection_items WHERE ${scope.where.join(' AND ')} ORDER BY external_item_id`
      )
      .all(...scope.params) as Array<{ external_item_id: string }>
  ).map(({ external_item_id }) => external_item_id);
};

describe('collection-query readable scope', () => {
  it.each([
    [undefined, 5],
    ['mine' as const, 1],
    ['shared' as const, 3],
  ])('keeps a fixed query shape for shared filter %s', (shared, expectedParameterCount) => {
    const scope = buildReadableItemScope('viewer', { shared });
    const sql = scope.where.join(' AND ');

    expect(scope.params).toHaveLength(expectedParameterCount);
    expect(sql.match(/user_share_grants/g) ?? []).toHaveLength(shared === 'mine' ? 0 : 2);
  });

  it('preserves mine, shared, folded book, and exact content grant semantics', () => {
    insertUser('viewer');
    insertUser('shared-owner');
    insertUser('unreadable-owner');
    insertItem('viewer', 'own-book', 'books', 'book');
    insertItem('viewer', 'own-movie', 'library', 'movie');
    insertItem('shared-owner', 'shared-book', 'books', 'book');
    insertItem('shared-owner', 'shared-movie', 'library', 'movie');
    insertItem('shared-owner', 'private-series', 'library', 'series');
    insertItem('unreadable-owner', 'unreadable-movie', 'library', 'movie');
    insertGrant('shared-owner', 'books', 'book', 1);
    insertGrant('shared-owner', 'library', 'movie', 1);
    insertGrant('shared-owner', 'library', 'series', 0);
    insertGrant('unreadable-owner', 'library', 'movie', 0);

    expect(selectReadableIds()).toEqual(['own-book', 'own-movie', 'shared-book', 'shared-movie']);
    expect(selectReadableIds('mine')).toEqual(['own-book', 'own-movie']);
    expect(selectReadableIds('shared')).toEqual(['shared-book', 'shared-movie']);
    expect(selectReadableIds(undefined, 'book')).toEqual(['own-book', 'shared-book']);
  });

  it.each([undefined, 'shared' as const])('searches collection items by username for shared filter %s', (shared) => {
    const db = getDatabase();
    insertUser('viewer');
    insertUser('shared-owner');
    insertItem('viewer', 'own-movie', 'library', 'movie');
    insertItem('shared-owner', 'shared-movie', 'library', 'movie');
    insertGrant('shared-owner', 'library', 'movie', 1);
    db.transaction(() => {
      for (let ownerIndex = 0; ownerIndex < 250; ownerIndex += 1) {
        const ownerUsernameHash = `unrelated-owner-${ownerIndex}`;
        insertUser(ownerUsernameHash);
        insertItem(ownerUsernameHash, `unrelated-movie-${ownerIndex}`, 'library', 'movie');
      }
    })();
    const scope = buildReadableItemScope('viewer', { shared });
    const plan = db
      .prepare(`EXPLAIN QUERY PLAN SELECT id FROM collection_items WHERE ${scope.where.join(' AND ')}`)
      .all(...scope.params) as Array<{ detail: string }>;

    expect(plan.map(({ detail }) => detail)).toContainEqual(
      expect.stringMatching(
        /SEARCH collection_items USING COVERING INDEX idx_collection_items_content_type \(username_hash=\?\)/
      )
    );
    expect(plan.some(({ detail }) => /^SCAN collection_items(?:\s|$)/.test(detail))).toBe(false);
    expect(
      plan.some(({ detail }) => /SEARCH candidate_grant USING INDEX idx_user_share_grants_shared_read/.test(detail))
    ).toBe(true);
    expect(plan.some(({ detail }) => /SEARCH readable_grant.*USING INDEX/.test(detail))).toBe(true);
  });
});
