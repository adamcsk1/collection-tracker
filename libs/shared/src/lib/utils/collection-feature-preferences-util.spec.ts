import { describe, expect, it } from 'vitest';
import { isCollectionFeaturePreferences } from './collection-feature-preferences-util';

describe('isCollectionFeaturePreferences', () => {
  it('accepts complete boolean preferences', () => {
    expect(
      isCollectionFeaturePreferences({ wishlist: true, watchLater: false, movieTracker: true, seriesTracker: false })
    ).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    { wishlist: true, watchLater: true, movieTracker: true },
    { wishlist: true, watchLater: true, movieTracker: true, seriesTracker: 'yes' },
    { wishlist: true, watchLater: true, movieTracker: true, seriesTracker: true, extra: true },
  ])('rejects invalid preferences %#', (value) => {
    expect(isCollectionFeaturePreferences(value)).toBe(false);
  });
});
