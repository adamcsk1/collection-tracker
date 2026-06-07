import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { describe, expect, it, vi } from 'vitest';
import { getItemHash, normalizeItem } from './collection-item-util';

vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));

const validItem: CollectionItemChangeApiModel = {
  image: 'poster.jpg',
  title: 'Test',
  genre: ['Drama'],
  IMDbId: 'tt0000001',
  tags: ['#movie'],
  year: '2024',
  rate: '7.1',
  rottenTomatoesRate: '96%',
  metacriticRate: '85/100',
  userRate: 8.7,
  actors: 'Actor One',
  plot: 'Plot',
};

describe('collection-item-util', () => {
  describe('normalizeItem', () => {
    it('returns normalized item for valid input', () => {
      const result = normalizeItem(validItem);

      expect(result).toEqual(validItem);
    });

    it('trims string fields and filters empty genre/tags', () => {
      const result = normalizeItem({
        ...validItem,
        title: '  Test  ',
        image: '  poster.jpg  ',
        IMDbId: '  tt0000001  ',
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

    it('returns undefined when IMDbId is missing', () => {
      expect(normalizeItem({ ...validItem, IMDbId: '' })).toBeUndefined();
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
    it('returns hashed JSON string of the item', () => {
      const result = getItemHash(validItem);
      expect(result).toBe(`hashed-${JSON.stringify(validItem)}`);
    });
  });
});
