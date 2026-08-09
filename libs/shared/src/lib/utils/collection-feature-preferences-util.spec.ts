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
        upNext: false,
        tracking: false,
      })
    ).toBe(true);
  });

  it('accepts legacy watching/watched keys via parse normalization', () => {
    expect(
      parseCollectionFeaturePreferences({
        books: true,
        wishlist: true,
        upNext: false,
        watched: true,
        watching: false,
      })
    ).toEqual({
      books: true,
      wishlist: true,
      upNext: false,
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
      upNext: false,
      tracking: true,
    });
  });

  it('merges finished pref into tracking when tracking missing', () => {
    expect(
      parseCollectionFeaturePreferences({
        books: true,
        wishlist: true,
        upNext: false,
        tracking: true,
      })
    ).toEqual({
      books: true,
      wishlist: true,
      upNext: false,
      tracking: true,
    });
  });

  it.each([
    null,
    [],
    {},
    { wishlist: true, upNext: true, tracking: true },
    {
      books: true,
      wishlist: true,
      upNext: true,
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
        upNext: false,
        tracking: false,
        books: true,
      })
    ).toEqual({
      wishlist: true,
      upNext: false,
      tracking: false,
      books: true,
    });
  });

  it('maps watchlist and hyphenated up-next keys to upNext', () => {
    expect(
      parseCollectionFeaturePreferences({
        wishlist: true,
        watchlist: false,
        tracking: false,
        books: true,
      })
    ).toEqual({
      wishlist: true,
      upNext: false,
      tracking: false,
      books: true,
    });
    expect(
      parseCollectionFeaturePreferences({
        wishlist: true,
        'up-next': false,
        tracking: false,
        books: true,
      })
    ).toEqual({
      wishlist: true,
      upNext: false,
      tracking: false,
      books: true,
    });
  });
});
