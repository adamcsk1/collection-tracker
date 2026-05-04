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
  year: 2024,
  rate: '7.1',
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

    it('returns undefined when year is neither number nor null', () => {
      expect(normalizeItem({ ...validItem, year: '2024' as any })).toBeUndefined();
    });

    it('accepts null year', () => {
      const result = normalizeItem({ ...validItem, year: null });
      expect(result?.year).toBeNull();
    });
  });

  describe('getItemHash', () => {
    it('returns hashed JSON string of the item', () => {
      const result = getItemHash(validItem);
      expect(result).toBe(`hashed-${JSON.stringify(validItem)}`);
    });
  });
});
