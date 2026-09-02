import { describe, expect, it } from 'vitest';
import { getAllowedAddContentTypes, getMediaChipEmptyIcon } from './list-util';

describe('getAllowedAddContentTypes', () => {
  it('locks to a single type when provided', () => {
    expect(getAllowedAddContentTypes('library', 'movie', true)).toEqual(['movie']);
    expect(getAllowedAddContentTypes('tracking', 'book', true)).toEqual(['book']);
  });

  it('returns hub defaults for All', () => {
    expect(getAllowedAddContentTypes('library', undefined, true, true)).toEqual(['movie', 'series', 'book', 'album']);
    expect(getAllowedAddContentTypes('library', undefined, false, false)).toEqual(['movie', 'series']);
    expect(getAllowedAddContentTypes('tracking', undefined, true, true)).toEqual(['movie', 'series', 'book', 'album']);
    expect(getAllowedAddContentTypes('tracking', undefined, false, false)).toEqual(['movie', 'series']);
    expect(getAllowedAddContentTypes('wishlist', undefined, true, true)).toEqual(['movie', 'series', 'book', 'album']);
    expect(getAllowedAddContentTypes('books', undefined, true)).toEqual(['book']);
    expect(getAllowedAddContentTypes('music', undefined, true, true)).toEqual(['album']);
  });
});

describe('getMediaChipEmptyIcon', () => {
  it('maps media chips to empty-state icons', () => {
    expect(getMediaChipEmptyIcon('all')).toBe('local_library');
    expect(getMediaChipEmptyIcon('movie')).toBe('movie');
    expect(getMediaChipEmptyIcon('series')).toBe('live_tv');
    expect(getMediaChipEmptyIcon('book')).toBe('menu_book');
  });
});
