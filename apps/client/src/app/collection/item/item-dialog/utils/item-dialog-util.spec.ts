import { describe, expect, it } from 'vitest';
import { buildIMDbSearchUrl, validateOptionalIMDbRateFormat } from './item-dialog-util';

describe('item dialog util', () => {
  it('builds an IMDb search URL from trimmed and encoded text', () => {
    expect(buildIMDbSearchUrl(' The Matrix & Reloaded ')).toBe(
      'https://www.imdb.com/find/?q=The%20Matrix%20%26%20Reloaded'
    );
  });

  it('accepts N/A as an unavailable IMDb rating', () => {
    expect(validateOptionalIMDbRateFormat('N/A')).toBeUndefined();
  });
});
