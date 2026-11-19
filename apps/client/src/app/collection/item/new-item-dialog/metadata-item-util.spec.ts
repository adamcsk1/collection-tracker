import { ExternalMetadataItemModel } from '@shared/models/external-metadata-model';
import { describe, expect, it } from 'vitest';
import { buildMetadataItem } from './metadata-item-util';

const metadata: ExternalMetadataItemModel = {
  provider: 'omdb',
  providerItemId: 'tt123',
  externalIds: [{ source: 'imdb', id: 'tt123' }],
  title: 'The Matrix',
  year: '1999',
  contentType: 'movie',
  poster: 'poster-url',
  plot: 'Plot',
  actors: 'Actors',
  genres: ['Action'],
  ratings: [
    { source: 'Internet Movie Database', value: '8.7/10' },
    { source: 'Rotten Tomatoes', value: '88%' },
    { source: 'Metacritic', value: '73/100' },
  ],
};

describe('buildMetadataItem', () => {
  it('maps metadata and identities without importing user-specific state', () => {
    expect(buildMetadataItem(metadata)).toEqual({
      image: 'poster-url',
      title: 'The Matrix',
      genre: ['Action'],
      IMDbId: 'tt123',
      externalProvider: 'omdb',
      externalItemId: 'tt123',
      externalIds: [{ source: 'imdb', id: 'tt123' }],
      tags: [],
      year: '1999',
      rate: '8.7',
      rottenTomatoesRate: '88%',
      metacriticRate: '73/100',
      userRate: null,
      actors: 'Actors',
      plot: 'Plot',
      contentType: 'movie',
      favorite: false,
    });
  });

  it.each([
    [' 2026–2028 ', '2026-2028'],
    ['2027–', '2027-'],
    ['2005.0', '2005'],
    ['N/A', null],
    ['', null],
  ])('normalizes year %s to %s', (year, expectedYear) => {
    expect(buildMetadataItem({ ...metadata, year }).year).toBe(expectedYear);
  });

  it.each([
    ['openlibrary', 'book', '9780441172719', 'isbn'],
    ['musicbrainz', 'album', '123e4567-e89b-12d3-a456-426614174000', 'musicbrainz'],
  ] as const)('preserves %s identities without inventing IMDb IDs', (provider, contentType, providerItemId, source) => {
    const externalIds = [{ source, id: providerItemId }];
    expect(buildMetadataItem({ ...metadata, provider, contentType, providerItemId, externalIds, ratings: [] })).toEqual(
      expect.objectContaining({
        externalProvider: provider,
        externalItemId: providerItemId,
        externalIds,
        contentType,
        IMDbId: undefined,
        rate: '',
        rottenTomatoesRate: '',
        metacriticRate: '',
      })
    );
  });
});
