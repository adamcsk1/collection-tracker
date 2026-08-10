import { describe, expect, it } from 'vitest';
import { buildIMDbSearchUrl, buildIMDbUrl, buildTrailerUrl, buildWebSearchUrl } from './item-dialog-util';

describe('item dialog util', () => {
  it('builds an IMDb URL from an ID', () => {
    expect(buildIMDbUrl('tt123')).toBe('https://www.imdb.com/title/tt123/');
  });

  it('builds an IMDb search URL from trimmed and encoded text', () => {
    expect(buildIMDbSearchUrl(' The Matrix & Reloaded ')).toBe(
      'https://www.imdb.com/find/?q=The%20Matrix%20%26%20Reloaded'
    );
  });

  it('builds a YouTube trailer URL', () => {
    expect(buildTrailerUrl('The Matrix', 1999)).toBe(
      'https://www.youtube.com/results?search_query=The%20Matrix%201999%20trailer'
    );
    expect(buildTrailerUrl('The Matrix', null)).toBe(
      'https://www.youtube.com/results?search_query=The%20Matrix%20%20trailer'
    );
  });

  it('builds a web search URL', () => {
    expect(buildWebSearchUrl('The Matrix', 1999)).toBe('https://duckduckgo.com/?q=The%20Matrix%201999');
  });
});
