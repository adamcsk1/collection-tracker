import { describe, expect, it } from 'vitest';
import { ExternalMetadataItemModel } from '../models/external-metadata-model';
import {
  getImdbIdFromExternalMetadata,
  isImdbShapedExternalItemId,
  mergeImdbExternalId,
} from './external-metadata-identity-util';

const buildItem = (overrides: Partial<ExternalMetadataItemModel> = {}): ExternalMetadataItemModel => ({
  provider: 'omdb',
  providerItemId: 'tt0133093',
  title: 'The Matrix',
  year: '1999',
  contentType: 'movie',
  poster: '',
  plot: '',
  actors: '',
  genres: [],
  ratings: [],
  ...overrides,
});

describe('external-metadata-identity-util', () => {
  it('reads imdb id from externalIds', () => {
    expect(
      getImdbIdFromExternalMetadata(
        buildItem({
          providerItemId: '603',
          externalIds: [{ source: 'imdb', id: 'tt0133093' }],
        })
      )
    ).toBe('tt0133093');
  });

  it('falls back to tt-shaped provider item ids when externalIds omit imdb', () => {
    expect(getImdbIdFromExternalMetadata(buildItem({ externalIds: undefined }))).toBe('tt0133093');
    expect(getImdbIdFromExternalMetadata(buildItem({ providerItemId: '603', externalIds: [] }))).toBeUndefined();
  });

  it('detects imdb-shaped provider item ids', () => {
    expect(isImdbShapedExternalItemId('tt0133093')).toBe(true);
    expect(isImdbShapedExternalItemId('TT0000001')).toBe(true);
    expect(isImdbShapedExternalItemId('603')).toBe(false);
    expect(isImdbShapedExternalItemId('')).toBe(false);
    expect(isImdbShapedExternalItemId(null)).toBe(false);
  });

  it('merges imdb external ids and rewrites imdb-shaped provider aliases', () => {
    expect(
      mergeImdbExternalId(
        [
          { source: 'omdb', id: 'tt0000001' },
          { source: 'imdb', id: 'tt0000001' },
        ],
        'tt0000002'
      )
    ).toEqual([
      { source: 'omdb', id: 'tt0000002' },
      { source: 'imdb', id: 'tt0000002' },
    ]);
    expect(mergeImdbExternalId([{ source: 'omdb', id: '603' }], 'tt0000002')).toEqual([
      { source: 'omdb', id: '603' },
      { source: 'imdb', id: 'tt0000002' },
    ]);
    expect(mergeImdbExternalId([{ source: 'omdb', id: '603' }], '  ')).toEqual([{ source: 'omdb', id: '603' }]);
    expect(mergeImdbExternalId([{ source: 'imdb', id: 'tt0000001' }], null)).toBeUndefined();
  });
});
