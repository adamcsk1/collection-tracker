import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { getDatabase } from '../../database';
import { searchCollectionItems } from './collection-read-repository';
import { getCollectionStatistics } from './collection-statistics-repository';
import { insertCollectionItem } from './collection-write-repository';

const item: CollectionItemChangeApiModel = {
  image: '',
  title: 'First title',
  genre: ['Drama', 'drama'],
  externalProvider: 'omdb',
  externalItemId: 'tt1234567',
  tags: ['Favorite', 'favorite'],
  year: '1999',
  rate: '',
  rottenTomatoesRate: '',
  metacriticRate: '',
  userRate: null,
  actors: '',
  plot: '',
  contentType: 'movie',
  favorite: false,
};

describe('collection statistics', () => {
  beforeEach(() => {
    vi.stubEnv('COOKIE_SECRET', 'statistics-cursor-test-secret');
    const database = getDatabase();
    database.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'user');
    insertCollectionItem(database, 'user', 'first-hash', item);
    insertCollectionItem(database, 'user', 'second-hash', {
      ...item,
      title: 'Second title',
      externalItemId: 'tt7654321',
      tags: ['FAVORITE'],
      genre: ['DRAMA'],
    });
    insertCollectionItem(database, 'user', 'third-hash', {
      ...item,
      title: 'Unrelated title',
      externalItemId: 'tt1111111',
      tags: ['Other'],
      genre: ['Comedy'],
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, 'movie' as const])(
    'groups case variants once per title and matches drill-down counts for scope %s',
    (type) => {
      const database = getDatabase();
      const statistics = getCollectionStatistics(database, 'user', { type });
      expect(statistics.charts.tagCounts).toEqual([
        { tag: 'FAVORITE', count: 2 },
        { tag: 'Other', count: 1 },
      ]);
      expect(statistics.charts.genreCounts).toEqual([
        { genre: 'DRAMA', count: 2 },
        { genre: 'Comedy', count: 1 },
      ]);
      for (const { tag, count } of statistics.charts.tagCounts) {
        const results = searchCollectionItems(database, 'user', { limit: 50, filters: { type, tags: [tag] } });
        expect(results.items).toHaveLength(count);
      }
      for (const { genre, count } of statistics.charts.genreCounts) {
        const results = searchCollectionItems(database, 'user', { limit: 50, filters: { type, genres: [genre] } });
        expect(results.items).toHaveLength(count);
      }
    }
  );
});
