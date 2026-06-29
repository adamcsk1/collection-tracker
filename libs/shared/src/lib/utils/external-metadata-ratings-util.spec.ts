import { describe, expect, it } from 'vitest';
import { getExternalMetadataRating } from './external-metadata-ratings-util';

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
});
