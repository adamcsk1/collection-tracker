import { describe, expect, it } from 'vitest';
import { getIMDbId, getIMDbIds } from './get-imdb-id-util';

describe('getIMDbId', () => {
  it('extracts the IMDb id when present', () => {
    expect(getIMDbId('[IMDb (tt0374455)](https://www.imdb.com/title/tt0374455/) (**8.1** / 10)')).toBe('tt0374455');
  });

  it('returns empty string when no id is present', () => {
    expect(getIMDbId('No id here')).toBe('');
  });

  it('extracts a standalone id', () => {
    expect(getIMDbId('see tt0133093 now')).toBe('tt0133093');
  });

  it('normalizes uppercase ids', () => {
    expect(getIMDbId('see TT0133093 now')).toBe('tt0133093');
  });

  it('ignores malformed ids', () => {
    expect(getIMDbId('tt1 tt0133093abc foott0133093')).toBe('');
  });
});

describe('getIMDbIds', () => {
  it('extracts unique IMDb ids in source order', () => {
    expect(getIMDbIds('TT0133093 https://www.imdb.com/title/tt0372784/ tt0133093')).toEqual(['tt0133093', 'tt0372784']);
  });

  it('ignores malformed ids', () => {
    expect(getIMDbIds('tt1 tt0133093abc foott0133093')).toEqual([]);
  });

  it('returns an empty array when no ids are present', () => {
    expect(getIMDbIds('No ids here')).toEqual([]);
  });
});
