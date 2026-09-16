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
        music: true,
        wishlist: true,
        upNext: false,
        tracking: false,
      })
    ).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    { wishlist: true, upNext: true, tracking: true },
    {
      books: true,
      music: true,
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
      music: true,
    });
  });
});
