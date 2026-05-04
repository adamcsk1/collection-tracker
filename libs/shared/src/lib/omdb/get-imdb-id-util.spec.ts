import { describe, expect, it } from 'vitest';
import { getIMDbId } from './get-imdb-id-util';

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
});
