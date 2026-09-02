import { describe, expect, it } from 'vitest';
import { getDatabase } from '../../database';
import { buildItemWhere, buildReadableItemScope } from './collection-query';

const insertUser = (usernameHash: string): void => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertItem = (
  usernameHash: string,
  externalItemId: string,
  listType: 'library' | 'books' | 'music' | 'tracking',
  contentType: 'movie' | 'series' | 'book' | 'album'
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
      `${usernameHash}-${listType}-${externalItemId}`,
      contentType
    );
};

const insertGrant = (
  ownerUsernameHash: string,
  listType: 'library' | 'books' | 'music',
  contentType: 'movie' | 'series' | 'book' | 'album',
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

const selectReadableIds = (shared?: 'mine' | 'shared', type?: 'movie' | 'series' | 'book' | 'album'): string[] => {
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
    insertItem('viewer', 'own-album', 'music', 'album');
    insertItem('viewer', 'own-movie', 'library', 'movie');
    insertItem('shared-owner', 'shared-book', 'books', 'book');
    insertItem('shared-owner', 'shared-album', 'music', 'album');
    insertItem('shared-owner', 'shared-movie', 'library', 'movie');
    insertItem('shared-owner', 'private-series', 'library', 'series');
    insertItem('unreadable-owner', 'unreadable-movie', 'library', 'movie');
    insertGrant('shared-owner', 'books', 'book', 1);
    insertGrant('shared-owner', 'music', 'album', 1);
    insertGrant('shared-owner', 'library', 'movie', 1);
    insertGrant('shared-owner', 'library', 'series', 0);
    insertGrant('unreadable-owner', 'library', 'movie', 0);

    expect(selectReadableIds()).toEqual([
      'own-album',
      'own-book',
      'own-movie',
      'shared-album',
      'shared-book',
      'shared-movie',
    ]);
    expect(selectReadableIds('mine')).toEqual(['own-album', 'own-book', 'own-movie']);
    expect(selectReadableIds('shared')).toEqual(['shared-album', 'shared-book', 'shared-movie']);
    expect(selectReadableIds(undefined, 'book')).toEqual(['own-book', 'shared-book']);
    expect(selectReadableIds(undefined, 'album')).toEqual(['own-album', 'shared-album']);
  });

  it('matches folded library albums against completed tracking twins for watched', () => {
    insertUser('viewer');
    insertItem('viewer', 'listened-album', 'music', 'album');
    insertItem('viewer', 'unlistened-album', 'music', 'album');
    insertItem('viewer', 'listened-album', 'tracking', 'album');
    const db = getDatabase();
    const trackingItemId = (
      db
        .prepare(`SELECT id FROM collection_items WHERE list_type = 'tracking' AND external_item_id = ?`)
        .get('listened-album') as { id: number }
    ).id;
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(
      trackingItemId,
      '2026-01-01 00:00:00'
    );

    const watchedScope = buildItemWhere('viewer', { listType: 'library', type: 'album', watched: true });
    const unwatchedScope = buildItemWhere('viewer', { listType: 'library', type: 'album', watched: false });

    expect(
      (
        db
          .prepare(
            `SELECT external_item_id FROM collection_items WHERE ${watchedScope.where.join(' AND ')} ORDER BY external_item_id`
          )
          .all(...watchedScope.params) as Array<{ external_item_id: string }>
      ).map(({ external_item_id }) => external_item_id)
    ).toEqual(['listened-album']);
    expect(
      (
        db
          .prepare(
            `SELECT external_item_id FROM collection_items WHERE ${unwatchedScope.where.join(' AND ')} ORDER BY external_item_id`
          )
          .all(...unwatchedScope.params) as Array<{ external_item_id: string }>
      ).map(({ external_item_id }) => external_item_id)
    ).toEqual(['unlistened-album']);
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
