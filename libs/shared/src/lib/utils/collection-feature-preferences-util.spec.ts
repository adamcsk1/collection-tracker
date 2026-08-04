import { describe, expect, it } from 'vitest';
import {
  isCollectionFeaturePreferences,
  parseCollectionFeaturePreferences,
} from './collection-feature-preferences-util';

describe('isCollectionFeaturePreferences', () => {
  it('accepts complete modern boolean preferences', () => {
    expect(
      isCollectionFeaturePreferences({
        books: true,
        wishlist: true,
        watchlist: false,
        watched: true,
        watching: false,
      })
    ).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    { wishlist: true, watchlist: true, watched: true, watching: true },
    {
      bookTracker: true,
      wishlist: true,
      watchLater: false,
      movieTracker: true,
      seriesTracker: false,
    },
    {
      books: true,
      wishlist: true,
      watchlist: true,
      watched: true,
      watching: true,
      extra: true,
    },
  ])('rejects invalid preferences %#', (value) => {
    expect(isCollectionFeaturePreferences(value)).toBe(false);
  });
});

describe('parseCollectionFeaturePreferences', () => {
  it('returns modern preferences', () => {
    expect(
      parseCollectionFeaturePreferences({
        wishlist: true,
        watchlist: false,
        watched: true,
        watching: false,
        books: true,
      })
    ).toEqual({
      wishlist: true,
      watchlist: false,
      watched: true,
      watching: false,
      books: true,
    });
  });
});
