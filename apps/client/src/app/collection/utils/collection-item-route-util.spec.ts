import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import {
  buildCollectionItemQueryValue,
  clearCollectionItemQuery,
  parseCollectionItemQueryValue,
  setCollectionItemQuery,
} from './collection-item-route-util';

const createRouter = (): Router => ({ navigate: vi.fn(() => Promise.resolve(true)) }) as unknown as Router;

describe('buildCollectionItemQueryValue', () => {
  it('joins provider and external id', () => {
    expect(buildCollectionItemQueryValue({ externalProvider: 'omdb', externalItemId: 'tt0133093' })).toBe(
      'omdb:tt0133093'
    );
  });
});

describe('parseCollectionItemQueryValue', () => {
  it('parses a valid identity', () => {
    expect(parseCollectionItemQueryValue('omdb:tt0133093')).toEqual({ source: 'omdb', id: 'tt0133093' });
  });

  it('parses openlibrary and alias sources', () => {
    expect(parseCollectionItemQueryValue('openlibrary:9780306406157')).toEqual({
      source: 'openlibrary',
      id: '9780306406157',
    });
    expect(parseCollectionItemQueryValue('imdb:tt0133093')).toEqual({ source: 'imdb', id: 'tt0133093' });
  });

  it('rejects missing, malformed, and unknown sources', () => {
    expect(parseCollectionItemQueryValue(null)).toBeNull();
    expect(parseCollectionItemQueryValue('')).toBeNull();
    expect(parseCollectionItemQueryValue('nocolon')).toBeNull();
    expect(parseCollectionItemQueryValue(':tt0133093')).toBeNull();
    expect(parseCollectionItemQueryValue('omdb:')).toBeNull();
    expect(parseCollectionItemQueryValue('omdb:   ')).toBeNull();
    expect(parseCollectionItemQueryValue('unknown:tt0133093')).toBeNull();
  });
});

describe('setCollectionItemQuery', () => {
  it('merges the item param on the current list', () => {
    const router = createRouter();

    setCollectionItemQuery(router, { externalProvider: 'omdb', externalItemId: 'tt1', listType: 'library' }, 'library');

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { item: 'omdb:tt1' },
      queryParamsHandling: 'merge',
    });
  });

  it('navigates to the item list when it differs from the current list', () => {
    const router = createRouter();

    setCollectionItemQuery(
      router,
      { externalProvider: 'omdb', externalItemId: 'tt1', listType: 'tracking' },
      'library'
    );

    expect(router.navigate).toHaveBeenCalledWith(['/collection', 'tracking'], {
      queryParams: { item: 'omdb:tt1' },
    });
  });
});

describe('clearCollectionItemQuery', () => {
  it('drops the item param', () => {
    const router = createRouter();

    clearCollectionItemQuery(router);

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { item: null },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  });

  it('can replace the current history entry', () => {
    const router = createRouter();

    clearCollectionItemQuery(router, true);

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { item: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });
});
