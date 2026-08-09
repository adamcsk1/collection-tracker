import { describe, expect, it } from 'vitest';
import {
  buildCollectionRouteFilterKey,
  buildCollectionRouteFilters,
  buildStandardSearchFilters,
} from './collection-search-filter-util';

describe('buildStandardSearchFilters', () => {
  it('builds default list type filters without search text', () => {
    expect(buildStandardSearchFilters(' ', 'wishlist')).toEqual({ listType: 'wishlist' });
  });

  it('builds text search filters', () => {
    expect(buildStandardSearchFilters(' dark ', 'tracking')).toEqual({
      search: 'dark',
      listType: 'tracking',
    });
  });

  it('builds tag search filters', () => {
    expect(buildStandardSearchFilters('#drama', 'up-next')).toEqual({
      tags: ['#drama'],
      tagMode: 'all',
      listType: 'up-next',
    });
  });

  it('treats old system tag names as custom tag searches', () => {
    expect(buildStandardSearchFilters('#completed', 'tracking')).toEqual({
      tags: ['#completed'],
      tagMode: 'all',
      listType: 'tracking',
    });
  });

  it('merges explicit route filters into standard search filters', () => {
    expect(buildStandardSearchFilters(' dark ', 'library', { type: 'movie', watched: false })).toEqual({
      search: 'dark',
      type: 'movie',
      watched: false,
      listType: 'library',
    });
  });
});

describe('buildCollectionRouteFilters', () => {
  it('builds explicit filters from query params', () => {
    const queryParams = new Map([
      ['type', 'series'],
      ['favorite', 'true'],
      ['watched', 'false'],
      ['completed', 'true'],
    ]);

    expect(buildCollectionRouteFilters({ get: (name) => queryParams.get(name) ?? null })).toEqual({
      type: 'series',
      favorite: true,
      watched: false,
      completed: true,
    });
  });
});

describe('buildCollectionRouteFilterKey', () => {
  it('returns an empty key when no explicit filters are active', () => {
    expect(buildCollectionRouteFilterKey({})).toBe('');
  });

  it('builds a stable key from explicit filters', () => {
    expect(buildCollectionRouteFilterKey({ type: 'movie', watched: false })).toBe(
      JSON.stringify({ type: 'movie', favorite: null, watched: false, completed: null, shared: null })
    );
  });

  it('includes shared filter in route filters and key', () => {
    expect(buildCollectionRouteFilters({ get: (name) => (name === 'shared' ? 'mine' : null) })).toEqual({
      shared: 'mine',
    });
    expect(buildCollectionRouteFilterKey({ shared: 'shared' })).toBe(
      JSON.stringify({ type: null, favorite: null, watched: null, completed: null, shared: 'shared' })
    );
  });
});
