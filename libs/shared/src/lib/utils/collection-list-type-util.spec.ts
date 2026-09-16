import { describe, expect, it } from 'vitest';
import { parseCollectionListType } from './collection-list-type-util';

describe('parseCollectionListType', () => {
  it('accepts current list types', () => {
    expect(parseCollectionListType('library')).toBe('library');
    expect(parseCollectionListType('wishlist')).toBe('wishlist');
    expect(parseCollectionListType('up-next')).toBe('up-next');
    expect(parseCollectionListType('tracking')).toBe('tracking');
    expect(parseCollectionListType('books')).toBe('books');
    expect(parseCollectionListType('music')).toBe('music');
  });

  it('rejects invalid values', () => {
    expect(parseCollectionListType(undefined)).toBeUndefined();
    expect(parseCollectionListType(null)).toBeUndefined();
    expect(parseCollectionListType(1)).toBeUndefined();
    expect(parseCollectionListType('unknown')).toBeUndefined();
  });
});
