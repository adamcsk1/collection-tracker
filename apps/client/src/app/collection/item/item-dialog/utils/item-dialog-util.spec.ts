import { describe, expect, it } from 'vitest';
import { buildIMDbSearchUrl } from './item-dialog-util';

describe('item dialog util', () => {
  it('builds an IMDb search URL from trimmed and encoded text', () => {
    expect(buildIMDbSearchUrl(' The Matrix & Reloaded ')).toBe(
      'https://www.imdb.com/find/?q=The%20Matrix%20%26%20Reloaded'
    );
  });
});
