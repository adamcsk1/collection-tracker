import { VIRTUAL_UNCOMPLETED_TAG, VIRTUAL_UNWATCHED_TAG } from '@shared/constants/tags-const';
import { describe, expect, it } from 'vitest';
import { buildStandardSearchFilters } from './collection-search-filter-util';

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

  it('builds virtual unwatched filters', () => {
    expect(buildStandardSearchFilters(VIRTUAL_UNWATCHED_TAG, 'library')).toEqual({
      watched: false,
      listType: 'library',
    });
  });

  it('builds virtual uncompleted filters', () => {
    expect(buildStandardSearchFilters(VIRTUAL_UNCOMPLETED_TAG, 'series-tracker')).toEqual({
      completed: false,
      listType: 'series-tracker',
    });
  });
});
