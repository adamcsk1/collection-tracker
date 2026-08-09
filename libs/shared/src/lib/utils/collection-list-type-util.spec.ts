import { describe, expect, it } from 'vitest';
import { parseCollectionListType } from './collection-list-type-util';

describe('parseCollectionListType', () => {
  it('accepts current list types', () => {
    expect(parseCollectionListType('library')).toBe('library');
    expect(parseCollectionListType('wishlist')).toBe('wishlist');
    expect(parseCollectionListType('up-next')).toBe('up-next');
    expect(parseCollectionListType('tracking')).toBe('tracking');
    expect(parseCollectionListType('books')).toBe('books');
  });

  it('maps legacy list types', () => {
    expect(parseCollectionListType('watch-later')).toBe('up-next');
    expect(parseCollectionListType('watchlist')).toBe('up-next');
    expect(parseCollectionListType('series-tracker')).toBe('tracking');
    expect(parseCollectionListType('movie-tracker')).toBe('tracking');
    expect(parseCollectionListType('book-tracker')).toBe('books');
    expect(parseCollectionListType('watching')).toBe('tracking');
    expect(parseCollectionListType('watched')).toBe('tracking');
    expect(parseCollectionListType('finished')).toBe('tracking');
  });

  it('rejects invalid values', () => {
    expect(parseCollectionListType(undefined)).toBeUndefined();
    expect(parseCollectionListType(null)).toBeUndefined();
    expect(parseCollectionListType(1)).toBeUndefined();
    expect(parseCollectionListType('unknown')).toBeUndefined();
  });
});
