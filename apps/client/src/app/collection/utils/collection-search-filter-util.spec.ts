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
    expect(buildStandardSearchFilters(' dark ', 'series-tracker')).toEqual({
      search: 'dark',
      listType: 'series-tracker',
    });
  });

  it('builds tag search filters', () => {
    expect(buildStandardSearchFilters('#drama', 'watch-later')).toEqual({
      tags: ['#drama'],
      tagMode: 'all',
      listType: 'watch-later',
    });
  });

  it('treats old system tag names as custom tag searches', () => {
    expect(buildStandardSearchFilters('#completed', 'series-tracker')).toEqual({
      tags: ['#completed'],
      tagMode: 'all',
      listType: 'series-tracker',
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
      JSON.stringify({ type: 'movie', favorite: null, watched: false, completed: null })
    );
  });
});
