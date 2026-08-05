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
        tracking: false,
      })
    ).toBe(true);
  });

  it('accepts legacy watching/watched keys via parse normalization', () => {
    expect(
      parseCollectionFeaturePreferences({
        books: true,
        wishlist: true,
        watchlist: false,
        watched: true,
        watching: false,
      })
    ).toEqual({
      books: true,
      wishlist: true,
      watchlist: false,
      tracking: true,
    });
  });

  it('accepts fully mappable legacy tracker keys', () => {
    expect(
      parseCollectionFeaturePreferences({
        bookTracker: true,
        wishlist: true,
        watchLater: false,
        movieTracker: true,
        seriesTracker: false,
      })
    ).toEqual({
      books: true,
      wishlist: true,
      watchlist: false,
      tracking: true,
    });
  });

  it('merges finished pref into tracking when tracking missing', () => {
    expect(
      parseCollectionFeaturePreferences({
        books: true,
        wishlist: true,
        watchlist: false,
        tracking: true,
      })
    ).toEqual({
      books: true,
      wishlist: true,
      watchlist: false,
      tracking: true,
    });
  });

  it.each([
    null,
    [],
    {},
    { wishlist: true, watchlist: true, tracking: true },
    {
      books: true,
      wishlist: true,
      watchlist: true,
      tracking: true,
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
        tracking: false,
        books: true,
      })
    ).toEqual({
      wishlist: true,
      watchlist: false,
      tracking: false,
      books: true,
    });
  });
});
