import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDatabase } from '../../database';
import { searchCollectionItems } from './collection-read-repository';
import { findCollectionItemSuggestions } from './collection-suggestions-repository';
import { insertCollectionItem, updateCollectionItemByExternalId } from './collection-write-repository';

const item: CollectionItemChangeApiModel = {
  image: 'image.jpg',
  title: 'Original title',
  genre: ['Drama'],
  IMDbId: 'tt1234567',
  externalProvider: 'omdb',
  externalItemId: 'provider-123',
  externalIds: [],
  tags: ['favorite'],
  year: '2024',
  rate: '8.1',
  rottenTomatoesRate: '91%',
  metacriticRate: '74',
  userRate: 9,
  actors: 'First Contributor',
  plot: 'Original description',
  contentType: 'movie',
  favorite: true,
};

describe('collection-write-repository', () => {
  beforeEach(() => {
    getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  });

  it('persists normalized item data and hydrates the flat API model', () => {
    const db = getDatabase();

    const insertedItem = insertCollectionItem(db, 'user', 'hash-1', item, 'tracking');

    expect(insertedItem).toEqual(
      expect.objectContaining({
        IMDbId: 'tt1234567',
        rate: '8.1',
        rottenTomatoesRate: '91%',
        metacriticRate: '74',
        actors: 'First Contributor',
        plot: 'Original description',
        watchedAt: expect.any(String),
      })
    );
    expect(
      db.prepare('SELECT contributors, description FROM collection_items WHERE username_hash = ?').get('user')
    ).toEqual({ contributors: 'First Contributor', description: 'Original description' });
    expect(
      db
        .prepare(
          'SELECT source, value FROM collection_item_external_ratings WHERE item_id = (SELECT id FROM collection_items WHERE username_hash = ?) ORDER BY source'
        )
        .all('user')
    ).toEqual([
      { source: 'imdb', value: '8.1' },
      { source: 'metacritic', value: '74' },
      { source: 'rotten-tomatoes', value: '91%' },
    ]);

    expect(
      searchCollectionItems(db, ['user'], {
        offset: 0,
        limit: 10,
        filters: { listType: 'tracking', search: '91%' },
      }).items
    ).toHaveLength(1);
    expect(
      searchCollectionItems(db, ['user'], {
        offset: 0,
        limit: 10,
        filters: { listType: 'tracking', search: 'tt1234567' },
      }).items
    ).toHaveLength(1);
    expect(findCollectionItemSuggestions(db, ['user'], 'Contributor', 10, 'tracking')).toEqual([
      { label: 'Original title', value: 'tt1234567', kind: 'title' },
    ]);
  });

  it('atomically replaces normalized fields and relations', () => {
    const db = getDatabase();
    insertCollectionItem(db, 'user', 'hash-1', item);

    const updatedItem = {
      ...item,
      IMDbId: 'tt7654321',
      rate: '',
      rottenTomatoesRate: '95%',
      metacriticRate: '',
      actors: 'Updated Contributor',
      plot: 'Updated description',
      genre: ['Comedy'],
      tags: ['updated'],
    };
    const result = updateCollectionItemByExternalId(db, 'user', 'omdb', 'provider-123', 'hash-2', updatedItem);

    expect(result).toEqual(
      expect.objectContaining({
        IMDbId: 'tt7654321',
        rate: '',
        rottenTomatoesRate: '95%',
        metacriticRate: '',
        actors: 'Updated Contributor',
        plot: 'Updated description',
        genre: ['Comedy'],
        tags: ['updated'],
      })
    );
    expect(db.prepare('SELECT source, value FROM collection_item_external_ratings').all()).toEqual([
      { source: 'rotten-tomatoes', value: '95%' },
    ]);
  });

  it('rolls back the base row when identity persistence fails', () => {
    const db = getDatabase();
    db.exec(`CREATE TEMP TRIGGER fail_identity_insert
      BEFORE INSERT ON external_item_identities
      BEGIN
        SELECT RAISE(ABORT, 'identity failure');
      END`);

    expect(() => insertCollectionItem(db, 'user', 'hash-1', item)).toThrow('identity failure');
    expect(db.prepare('SELECT COUNT(*) AS count FROM collection_items WHERE username_hash = ?').get('user')).toEqual({
      count: 0,
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM collection_item_external_ratings').get()).toEqual({ count: 0 });
    db.exec('DROP TRIGGER fail_identity_insert');
  });

  it('marks tracking books complete from updated content type and equal progress', () => {
    const db = getDatabase();
    const bookItem: CollectionItemChangeApiModel = {
      image: '',
      title: 'Progress Book',
      genre: [],
      externalProvider: 'openlibrary',
      externalItemId: '9780306406157',
      externalIds: [{ source: 'isbn', id: '9780306406157' }],
      tags: [],
      year: '1965',
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      actors: '',
      plot: '',
      contentType: 'book',
      favorite: false,
    };
    insertCollectionItem(db, 'user', 'book-hash-1', bookItem, 'tracking', undefined, undefined, 10, 100);

    const result = updateCollectionItemByExternalId(
      db,
      'user',
      'openlibrary',
      '9780306406157',
      'book-hash-2',
      { ...bookItem, progressCurrent: 200, progressTotal: 200 },
      'tracking'
    );

    expect(result).toEqual(
      expect.objectContaining({
        contentType: 'book',
        progressCurrent: 200,
        progressTotal: 200,
        watchedAt: expect.any(String),
      })
    );
  });

  it('does not apply book completion rules when updated content type is not book', () => {
    const db = getDatabase();
    insertCollectionItem(db, 'user', 'hash-1', item, 'tracking');
    const itemId = (db.prepare('SELECT id FROM collection_items WHERE username_hash = ?').get('user') as { id: number })
      .id;
    db.prepare(
      'UPDATE collection_item_tracker_state SET completed_at = ?, progress_current = ?, progress_total = ? WHERE item_id = ?'
    ).run('2026-01-01 00:00:00', 10, 100, itemId);

    const result = updateCollectionItemByExternalId(
      db,
      'user',
      'omdb',
      'provider-123',
      'hash-2',
      { ...item, progressCurrent: 50, progressTotal: 100 },
      'tracking'
    );

    expect(result).toEqual(
      expect.objectContaining({
        contentType: 'movie',
        progressCurrent: 50,
        progressTotal: 100,
        watchedAt: '2026-01-01 00:00:00',
      })
    );
    expect(
      db
        .prepare(
          'SELECT completed_at, progress_current, progress_total FROM collection_item_tracker_state WHERE item_id = ?'
        )
        .get(itemId)
    ).toEqual({ completed_at: '2026-01-01 00:00:00', progress_current: 50, progress_total: 100 });
  });
});
