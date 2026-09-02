import { describe, expect, it } from 'vitest';
import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import {
  buildItemFormFromChange,
  buildItemFromForm,
  isImdbIdValid,
  isMbidValid,
  validateOptionalIMDbRateFormat,
  validateOptionalMetacriticRateFormat,
  validateOptionalRottenTomatoesRateFormat,
} from './item-form-util';

describe('item form util', () => {
  it('validates IMDb rate formats', () => {
    expect(validateOptionalIMDbRateFormat('')).toBeUndefined();
    expect(validateOptionalIMDbRateFormat('N/A')).toBeUndefined();
    expect(validateOptionalIMDbRateFormat('8.5')).toBeUndefined();
    expect(validateOptionalIMDbRateFormat('10')).toBeUndefined();
    expect(validateOptionalIMDbRateFormat('11')).toEqual({ kind: 'rateFormat' });
  });

  it('validates Rotten Tomatoes rate formats', () => {
    expect(validateOptionalRottenTomatoesRateFormat('')).toBeUndefined();
    expect(validateOptionalRottenTomatoesRateFormat('95%')).toBeUndefined();
    expect(validateOptionalRottenTomatoesRateFormat('100%')).toBeUndefined();
    expect(validateOptionalRottenTomatoesRateFormat('95')).toEqual({ kind: 'rateFormat' });
  });

  it('validates Metacritic rate formats', () => {
    expect(validateOptionalMetacriticRateFormat('')).toBeUndefined();
    expect(validateOptionalMetacriticRateFormat('85/100')).toBeUndefined();
    expect(validateOptionalMetacriticRateFormat('100/100')).toBeUndefined();
    expect(validateOptionalMetacriticRateFormat('85')).toEqual({ kind: 'rateFormat' });
  });

  it('checks IMDb ID shape', () => {
    expect(isImdbIdValid('tt1234567')).toBe(true);
    expect(isImdbIdValid('TT123')).toBe(true);
    expect(isImdbIdValid('https://www.imdb.com/title/tt0116213')).toBe(true);
    expect(isImdbIdValid('nm123')).toBe(false);
    expect(isImdbIdValid('')).toBe(false);
  });

  it('builds item from form values', () => {
    const item = buildItemFromForm({
      title: ' Test Title ',
      IMDbId: 'tt1234567',
      year: '2020',
      rate: '8.5',
      rottenTomatoesRate: '95%',
      metacriticRate: '85/100',
      userRate: 9,
      image: 'image-url',
      genreText: 'Drama, Action',
      tagsText: '#tag1 tag2',
      actors: 'Actor One, Actor Two',
      plot: 'Plot text',
      contentType: 'movie',
      progressCurrent: null,
      progressTotal: null,
    });

    expect(item.title).toBe('Test Title');
    expect(item.IMDbId).toBe('tt1234567');
    expect(item.externalProvider).toBe('omdb');
    expect(item.externalItemId).toBe('tt1234567');
    expect(item.externalIds).toEqual([{ source: 'imdb', id: 'tt1234567' }]);
    expect(item.genre).toEqual(['Drama', 'Action']);
    expect(item.tags).toEqual(['#tag1', 'tag2']);
    expect(item.contentType).toBe('movie');
  });

  it('extracts IMDb id from URL when building movie form item', () => {
    const item = buildItemFromForm({
      title: 'Test Title',
      IMDbId: 'https://www.imdb.com/title/tt0116213/',
      year: '1996',
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      image: '',
      genreText: '',
      tagsText: '',
      actors: '',
      plot: '',
      contentType: 'movie',
      progressCurrent: null,
      progressTotal: null,
    });

    expect(item.IMDbId).toBe('tt0116213');
    expect(item.externalItemId).toBe('tt0116213');
    expect(item.externalIds).toEqual([{ source: 'imdb', id: 'tt0116213' }]);
  });

  it('builds openlibrary book items from form values', () => {
    const item = buildItemFromForm({
      title: ' Dune ',
      IMDbId: '0-306-40615-2',
      year: '1965',
      rate: '8.5',
      rottenTomatoesRate: '95%',
      metacriticRate: '85/100',
      userRate: 9,
      image: 'cover-url',
      genreText: 'Sci-Fi',
      tagsText: 'owned',
      actors: 'Frank Herbert',
      plot: 'Desert planet',
      contentType: 'book',
      progressCurrent: null,
      progressTotal: null,
    });

    expect(item).toEqual(
      expect.objectContaining({
        title: 'Dune',
        IMDbId: undefined,
        externalProvider: 'openlibrary',
        externalItemId: '9780306406157',
        externalIds: [{ source: 'isbn', id: '9780306406157' }],
        rate: '',
        rottenTomatoesRate: '',
        metacriticRate: '',
        contentType: 'book',
        actors: 'Frank Herbert',
      })
    );
  });

  it('extracts ISBN from Open Library URL when building book form item', () => {
    const item = buildItemFromForm({
      title: 'Dune',
      IMDbId: 'https://openlibrary.org/isbn/9780306406157',
      year: '1965',
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      image: '',
      genreText: '',
      tagsText: '',
      actors: '',
      plot: '',
      contentType: 'book',
      progressCurrent: null,
      progressTotal: null,
    });

    expect(item.externalItemId).toBe('9780306406157');
    expect(item.externalIds).toEqual([{ source: 'isbn', id: '9780306406157' }]);
  });

  it('builds musicbrainz album items from form values', () => {
    const item = buildItemFromForm({
      title: ' The Dark Side of the Moon ',
      IMDbId: 'F509C5FF-AD54-4DDE-B61E-24F750965835',
      year: '1973',
      rate: '8.5',
      rottenTomatoesRate: '95%',
      metacriticRate: '85/100',
      userRate: 9,
      image: 'cover-url',
      genreText: 'Progressive Rock',
      tagsText: 'owned',
      actors: 'Pink Floyd',
      plot: 'Studio album',
      contentType: 'album',
      progressCurrent: null,
      progressTotal: null,
    });

    expect(item).toEqual(
      expect.objectContaining({
        title: 'The Dark Side of the Moon',
        IMDbId: undefined,
        externalProvider: 'musicbrainz',
        externalItemId: 'f509c5ff-ad54-4dde-b61e-24f750965835',
        externalIds: [{ source: 'musicbrainz', id: 'f509c5ff-ad54-4dde-b61e-24f750965835' }],
        rate: '',
        rottenTomatoesRate: '',
        metacriticRate: '',
        contentType: 'album',
        actors: 'Pink Floyd',
      })
    );
  });

  it('extracts MBID from MusicBrainz URL when building album form item', () => {
    const item = buildItemFromForm({
      title: 'The Dark Side of the Moon',
      IMDbId: 'https://musicbrainz.org/release/f509c5ff-ad54-4dde-b61e-24f750965835',
      year: '1973',
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      image: '',
      genreText: '',
      tagsText: '',
      actors: '',
      plot: '',
      contentType: 'album',
      progressCurrent: null,
      progressTotal: null,
    });

    expect(item.externalItemId).toBe('f509c5ff-ad54-4dde-b61e-24f750965835');
    expect(item.externalIds).toEqual([{ source: 'musicbrainz', id: 'f509c5ff-ad54-4dde-b61e-24f750965835' }]);
  });

  it('clears album identity when MBID is invalid', () => {
    const item = buildItemFromForm({
      title: 'Unknown Album',
      IMDbId: 'not-a-uuid',
      year: '1973',
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      image: '',
      genreText: '',
      tagsText: '',
      actors: '',
      plot: '',
      contentType: 'album',
      progressCurrent: null,
      progressTotal: null,
    });

    expect(item.externalItemId).toBe('');
    expect(item.externalIds).toBeUndefined();
  });

  it('checks MBID shape', () => {
    expect(isMbidValid('f509c5ff-ad54-4dde-b61e-24f750965835')).toBe(true);
    expect(isMbidValid('https://musicbrainz.org/release/f509c5ff-ad54-4dde-b61e-24f750965835')).toBe(true);
    expect(isMbidValid('not-a-uuid')).toBe(false);
    expect(isMbidValid('')).toBe(false);
  });

  it('builds form model from item change', () => {
    const change: CollectionItemChangeApiModel = {
      title: 'Title',
      IMDbId: 'tt123',
      externalProvider: 'omdb',
      externalItemId: 'tt123',
      externalIds: [{ source: 'imdb', id: 'tt123' }],
      year: '2020',
      rate: '8.0/10',
      rottenTomatoesRate: '95%',
      metacriticRate: '85/100',
      userRate: 9,
      image: 'image',
      genre: ['Drama', 'Action'],
      tags: ['#tag1', 'tag2'],
      actors: 'Actors',
      plot: 'Plot',
      contentType: 'series',
      favorite: false,
    };

    const formModel = buildItemFormFromChange(change);

    expect(formModel.title).toBe('Title');
    expect(formModel.IMDbId).toBe('tt123');
    expect(formModel.rate).toBe('8.0');
    expect(formModel.genreText).toBe('Drama, Action');
    expect(formModel.tagsText).toBe('#tag1 tag2');
    expect(formModel.contentType).toBe('series');
  });
});
