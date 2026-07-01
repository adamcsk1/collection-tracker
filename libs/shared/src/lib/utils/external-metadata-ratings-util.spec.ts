import { describe, expect, it } from 'vitest';
import { getExternalMetadataRating, normalizeIMDbRating } from './external-metadata-ratings-util';

describe('external metadata ratings util', () => {
  it('returns the value for the matching rating source', () => {
    expect(
      getExternalMetadataRating(
        [
          { source: 'Internet Movie Database', value: '8.7/10' },
          { source: 'Rotten Tomatoes', value: '83%' },
        ],
        'Rotten Tomatoes'
      )
    ).toBe('83%');
  });

  it('returns an empty string when the rating source is missing', () => {
    expect(getExternalMetadataRating([{ source: 'Internet Movie Database', value: '8.7/10' }], 'Metacritic')).toBe('');
  });

  it('normalizes IMDb ratings with /10 denominators', () => {
    expect(
      getExternalMetadataRating([{ source: 'Internet Movie Database', value: '8.7/10' }], 'Internet Movie Database')
    ).toBe('8.7');
    expect(
      getExternalMetadataRating([{ source: 'Internet Movie Database', value: '10/10' }], 'Internet Movie Database')
    ).toBe('10');
    expect(
      getExternalMetadataRating([{ source: 'Internet Movie Database', value: '10.0/10' }], 'Internet Movie Database')
    ).toBe('10.0');
  });

  it('keeps IMDb ratings without /10 denominators unchanged', () => {
    expect(normalizeIMDbRating('8.0')).toBe('8.0');
    expect(normalizeIMDbRating('N/A')).toBe('N/A');
    expect(normalizeIMDbRating('')).toBe('');
  });

  it('does not normalize non-IMDb rating sources', () => {
    expect(getExternalMetadataRating([{ source: 'Metacritic', value: '85/100' }], 'Metacritic')).toBe('85/100');
  });
});
