import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { describe, expect, it } from 'vitest';
import { getItemHash, normalizeItem } from './collection-item-util';

const validItem: CollectionItemChangeApiModel = {
  image: 'poster.jpg',
  title: 'Test',
  genre: ['Drama'],
  IMDbId: 'tt0000001',
  externalProvider: 'omdb',
  externalItemId: 'tt0000001',
  tags: [],
  year: '2024',
  rate: '7.1',
  rottenTomatoesRate: '96%',
  metacriticRate: '85/100',
  userRate: 8.7,
  actors: 'Actor One',
  plot: 'Plot',
  contentType: 'movie',
  favorite: false,
};

describe('collection-item-util', () => {
  describe('normalizeItem', () => {
    it('returns normalized item for valid input', () => {
      const result = normalizeItem(validItem);

      expect(result).toEqual({
        ...validItem,
        externalIds: [{ source: 'imdb', id: 'tt0000001' }],
      });
    });

    it('trims string fields and filters empty genre/tags', () => {
      const result = normalizeItem({
        ...validItem,
        title: '  Test  ',
        image: '  poster.jpg  ',
        IMDbId: '  tt0000001  ',
        externalProvider: '  omdb  ' as any,
        externalItemId: '  tt0000001  ',
        rate: '  7.1  ',
        rottenTomatoesRate: '  96%  ',
        metacriticRate: '  85/100  ',
        actors: '  Actor One  ',
        plot: '  Plot  ',
        genre: ['  Drama  ', '', '  Comedy  '],
        tags: ['  #movie  ', '  ', '  #tv  '],
      });

      expect(result).toEqual({
        ...validItem,
        title: 'Test',
        image: 'poster.jpg',
        IMDbId: 'tt0000001',
        externalProvider: 'omdb',
        externalItemId: 'tt0000001',
        externalIds: [{ source: 'imdb', id: 'tt0000001' }],
        rate: '7.1',
        rottenTomatoesRate: '96%',
        metacriticRate: '85/100',
        actors: 'Actor One',
        plot: 'Plot',
        genre: ['Drama', 'Comedy'],
        tags: ['#movie', '#tv'],
      });
    });

    it('returns undefined when title is missing', () => {
      expect(normalizeItem({ ...validItem, title: '' })).toBeUndefined();
    });

    it('keeps legacy IMDbId unset when IMDbId is missing', () => {
      expect(normalizeItem({ ...validItem, IMDbId: '' })).toEqual({ ...validItem, IMDbId: undefined });
    });

    it('does not duplicate imdb external ids already present', () => {
      expect(
        normalizeItem({
          ...validItem,
          externalIds: [{ source: 'imdb', id: 'tt0000001' }],
        })
      ).toEqual({
        ...validItem,
        externalIds: [{ source: 'imdb', id: 'tt0000001' }],
      });
    });

    it('returns undefined when external provider is missing', () => {
      expect(normalizeItem({ ...validItem, externalProvider: '' as any })).toBeUndefined();
    });

    it('returns undefined when external item ID is missing', () => {
      expect(normalizeItem({ ...validItem, externalItemId: '' })).toBeUndefined();
    });

    it('returns undefined when a required string field has wrong type', () => {
      expect(normalizeItem({ ...validItem, title: 123 as any })).toBeUndefined();
    });

    it('returns undefined when genre is not an array', () => {
      expect(normalizeItem({ ...validItem, genre: 'Drama' as any })).toBeUndefined();
    });

    it('returns undefined when tags is not an array', () => {
      expect(normalizeItem({ ...validItem, tags: '#movie' as any })).toBeUndefined();
    });

    it('accepts year intervals', () => {
      const result = normalizeItem({ ...validItem, year: '2026-2028' });
      expect(result?.year).toBe('2026-2028');
    });

    it('converts numeric year to string', () => {
      const result = normalizeItem({ ...validItem, year: 2024 as any });
      expect(result?.year).toBe('2024');
    });

    it('normalizes decimal year artifacts', () => {
      const result = normalizeItem({ ...validItem, year: '2005.0' });
      expect(result?.year).toBe('2005');
    });

    it('returns undefined when year is neither string, number, nor null', () => {
      expect(normalizeItem({ ...validItem, year: {} as any })).toBeUndefined();
    });

    it('accepts null year', () => {
      const result = normalizeItem({ ...validItem, year: null });
      expect(result?.year).toBeNull();
    });

    it('accepts null user rate', () => {
      const result = normalizeItem({ ...validItem, userRate: null });
      expect(result?.userRate).toBeNull();
    });

    it('returns undefined when user rate is outside range', () => {
      expect(normalizeItem({ ...validItem, userRate: 10.1 })).toBeUndefined();
    });

    it('returns undefined when user rate is not a tenth increment', () => {
      expect(normalizeItem({ ...validItem, userRate: 8.75 })).toBeUndefined();
    });
  });

  describe('getItemHash', () => {
    it('returns a sha-512 hex hash of the JSON string', () => {
      const result = getItemHash(validItem);

      expect(result).toMatch(/^[a-f0-9]{128}$/);
    });
  });
});
