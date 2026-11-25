import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionItemChangeApiModel, CollectionItemFiltersApiModel } from '@shared/models/api-model';
import { getDatabase } from '../../database';
import { insertCollectionItem } from './collection-write-repository';
import { searchCollectionItems } from './collection-read-repository';
import { getCollectionActivity } from './collection-activity-repository';

const item: CollectionItemChangeApiModel = {
  image: '',
  title: 'Title',
  genre: [],
  externalProvider: 'omdb',
  externalItemId: 'tt1234567',
  tags: [],
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

describe('collection activity', () => {
  it('uses the stored calendar date consistently for offset timestamps', () => {
    const database = getDatabase();
    insertCollectionItem(database, 'user', 'hash', item, 'tracking', '2026-02-01T00:30:00+02:00');
    const activity = getCollectionActivity(database, 'user', 2026);
    expect(activity.months[0].count).toBe(0);
    expect(activity.months[1].count).toBe(1);
    const filters: CollectionItemFiltersApiModel = {
      activityYear: 2026,
      activityStatus: 'completed',
      activityMonth: 2,
    };
    expect(searchCollectionItems(database, 'user', { limit: 50, filters }).items).toHaveLength(1);
    expect(
      searchCollectionItems(database, 'user', { limit: 50, filters: { ...filters, activityMonth: 1 } }).items
    ).toHaveLength(0);
  });
  beforeEach(() => {
    vi.stubEnv('COOKIE_SECRET', 'statistics-cursor-test-secret');
    for (const username of ['user', 'other'])
      getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(username, username);
  });
  afterEach(() => vi.unstubAllEnvs());
  it('counts own plans once across lists and completion by date, not release year', () => {
    const database = getDatabase();
    insertCollectionItem(database, 'user', 'hash', { ...item, plannedYear: 2026 });
    insertCollectionItem(database, 'user', 'hash', { ...item, plannedYear: 2026 }, 'tracking', '2026-02-01');
    insertCollectionItem(database, 'other', 'hash', { ...item, plannedYear: 2026 }, 'tracking', '2026-02-01');
    insertCollectionItem(
      database,
      'user',
      'hash',
      { ...item, externalItemId: 'tt7654321' },
      'tracking',
      '2025-12-31 23:59:59'
    );
    const data = getCollectionActivity(database, 'user', 2026);
    expect(data).toMatchObject({ planned: 1, completed: 1, inProgress: 0 });
    expect(data.months).toHaveLength(12);
    expect(data.months[1]).toEqual({ month: 2, count: 1 });
    expect(getCollectionActivity(database, 'user', 2025).completed).toBe(1);
    expect(getCollectionActivity(database, 'user', 1999).completed).toBe(0);
    expect(getCollectionActivity(database, 'user', 2026, 'book').planned).toBe(0);
  });
  it('reports live progress across years but excludes unstarted books and albums', () => {
    const database = getDatabase();
    insertCollectionItem(database, 'user', 'hash', { ...item, contentType: 'series' }, 'tracking');
    insertCollectionItem(
      database,
      'user',
      'hash',
      { ...item, externalProvider: 'openlibrary', externalItemId: 'OL1W', contentType: 'book' },
      'tracking'
    );
    insertCollectionItem(
      database,
      'user',
      'hash',
      { ...item, externalProvider: 'openlibrary', externalItemId: 'OL2W', contentType: 'book' },
      'tracking',
      null,
      undefined,
      5,
      20
    );
    expect(getCollectionActivity(database, 'user', 2026).inProgress).toBe(2);
    expect(getCollectionActivity(database, 'user', 2025).inProgress).toBe(2);
  });
  it('deduplicates plans after other filters and cursor-pages matching titles', () => {
    const database = getDatabase();
    insertCollectionItem(database, 'user', 'hash', { ...item, plannedYear: 2026 });
    insertCollectionItem(
      database,
      'user',
      'hash',
      { ...item, plannedYear: 2026, favorite: true },
      'tracking',
      '2026-03-01'
    );
    insertCollectionItem(database, 'user', 'hash', {
      ...item,
      plannedYear: 2026,
      externalItemId: 'tt7654321',
      title: 'Z title',
      favorite: true,
    });
    const filters: CollectionItemFiltersApiModel = {
      activityYear: 2026,
      activityStatus: 'planned',
      favorite: true,
      orderBy: 'alphabet',
      orderDirection: 'asc',
    };
    const first = searchCollectionItems(database, 'user', { limit: 1, filters });
    expect(first.items).toHaveLength(1);
    expect(first.items[0].listType).toBe('tracking');
    const second = searchCollectionItems(database, 'user', { limit: 1, filters, cursor: first.page.nextCursor! });
    expect(second.items[0].title).toBe('Z title');
    expect(second.page.hasMore).toBe(false);
    expect(() =>
      searchCollectionItems(database, 'user', {
        limit: 1,
        filters: { ...filters, activityYear: 2025 },
        cursor: first.page.nextCursor!,
      })
    ).toThrow();
  });
  it('uses half-open month boundaries and excludes other owners', () => {
    const database = getDatabase();
    insertCollectionItem(database, 'user', 'hash', item, 'tracking', '2026-02-01 00:00:00');
    insertCollectionItem(
      database,
      'user',
      'hash',
      { ...item, externalItemId: 'tt7654321' },
      'tracking',
      '2026-03-01 00:00:00'
    );
    const page = searchCollectionItems(database, 'user', {
      limit: 50,
      filters: { activityYear: 2026, activityStatus: 'completed', activityMonth: 2 },
    });
    expect(page.items.map((entry) => entry.externalItemId)).toEqual(['tt1234567']);
    expect(
      searchCollectionItems(database, 'other', {
        limit: 50,
        filters: { activityYear: 2026, activityStatus: 'completed' },
      }).items
    ).toEqual([]);
  });
});
