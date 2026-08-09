import { describe, expect, it } from 'vitest';
import {
  MAX_COLLECTION_FILTER_GENRES,
  MAX_COLLECTION_FILTER_TAGS,
} from '@shared/constants/collection-filter-api-const';
import {
  areCollectionFilterListsWithinLimits,
  parseBoolean,
  parseFilters,
  parseList,
  parseNumber,
  parseSharedFilter,
  parseTagMode,
  parseType,
} from './query-parse-util';

describe('query-parse-util', () => {
  describe('parseList', () => {
    it('returns undefined for non-string non-array values', () => {
      expect(parseList(undefined)).toBeUndefined();
      expect(parseList(null)).toBeUndefined();
      expect(parseList(42)).toBeUndefined();
    });

    it('splits comma-separated strings and trims whitespace', () => {
      expect(parseList('a, b, c')).toEqual(['a', 'b', 'c']);
    });

    it('filters empty strings', () => {
      expect(parseList('a, , b')).toEqual(['a', 'b']);
      expect(parseList('')).toBeUndefined();
    });

    it('flattens nested arrays', () => {
      expect(parseList(['a', ['b', 'c']])).toEqual(['a', 'b', 'c']);
    });

    it('returns undefined when all entries are empty', () => {
      expect(parseList(' , , ')).toBeUndefined();
    });
  });

  describe('parseBoolean', () => {
    it('returns true for string "true"', () => {
      expect(parseBoolean('true')).toBe(true);
    });

    it('returns false for string "false"', () => {
      expect(parseBoolean('false')).toBe(false);
    });

    it('returns undefined for other values', () => {
      expect(parseBoolean('yes')).toBeUndefined();
      expect(parseBoolean(true)).toBeUndefined();
      expect(parseBoolean(false)).toBeUndefined();
      expect(parseBoolean(undefined)).toBeUndefined();
    });
  });

  describe('parseType', () => {
    it('returns movie for "movie"', () => {
      expect(parseType('movie')).toBe('movie');
    });

    it('returns series for "series"', () => {
      expect(parseType('series')).toBe('series');
    });

    it('returns book for "book"', () => {
      expect(parseType('book')).toBe('book');
    });

    it('returns undefined for other values', () => {
      expect(parseType('game')).toBeUndefined();
      expect(parseType(undefined)).toBeUndefined();
    });
  });

  describe('parseTagMode', () => {
    it('returns any for "any"', () => {
      expect(parseTagMode('any')).toBe('any');
    });

    it('returns all for "all"', () => {
      expect(parseTagMode('all')).toBe('all');
    });

    it('returns undefined for other values', () => {
      expect(parseTagMode('some')).toBeUndefined();
      expect(parseTagMode(undefined)).toBeUndefined();
    });
  });

  describe('parseSharedFilter', () => {
    it('returns mine for "mine"', () => {
      expect(parseSharedFilter('mine')).toBe('mine');
    });

    it('returns shared for "shared"', () => {
      expect(parseSharedFilter('shared')).toBe('shared');
    });

    it('returns undefined for unsupported values', () => {
      expect(parseSharedFilter('all')).toBeUndefined();
      expect(parseSharedFilter(undefined)).toBeUndefined();
    });
  });

  describe('parseNumber', () => {
    it('parses valid numbers', () => {
      expect(parseNumber('42', 0)).toBe(42);
      expect(parseNumber(7, 0)).toBe(7);
    });

    it('returns fallback for invalid numbers', () => {
      expect(parseNumber('abc', 99)).toBe(99);
      expect(parseNumber(undefined, 5)).toBe(5);
      expect(parseNumber(NaN, 3)).toBe(3);
      expect(parseNumber(Infinity, 2)).toBe(2);
    });
  });

  describe('parseFilters', () => {
    it('parses all supported filter fields', () => {
      const result = parseFilters({
        search: 'matrix',
        tags: 'sci-fi, action',
        genres: 'drama',
        tagMode: 'all',
        type: 'movie',
        favorite: 'true',
        watched: 'true',
        completed: 'false',
        shared: 'shared',
        listType: 'library',
        orderBy: 'alphabet',
        orderDirection: 'asc',
      });

      expect(result).toEqual({
        search: 'matrix',
        tags: ['sci-fi', 'action'],
        genres: ['drama'],
        tagMode: 'all',
        type: 'movie',
        favorite: true,
        watched: true,
        completed: false,
        shared: 'shared',
        listType: 'library',
        orderBy: 'alphabet',
        orderDirection: 'asc',
      });
    });

    it('returns undefined for missing fields', () => {
      const result = parseFilters({});
      expect(result).toEqual({
        search: undefined,
        tags: undefined,
        genres: undefined,
        tagMode: undefined,
        type: undefined,
        favorite: undefined,
        watched: undefined,
        completed: undefined,
        shared: undefined,
        listType: undefined,
        orderBy: undefined,
        orderDirection: undefined,
      });
    });

    it('ignores unsupported query keys', () => {
      const result = parseFilters({ foo: 'bar' } as Record<string, unknown>);
      expect(result).toEqual({
        search: undefined,
        tags: undefined,
        genres: undefined,
        tagMode: undefined,
        type: undefined,
        favorite: undefined,
        watched: undefined,
        completed: undefined,
        shared: undefined,
        listType: undefined,
        orderBy: undefined,
        orderDirection: undefined,
      });
    });
  });

  describe('areCollectionFilterListsWithinLimits', () => {
    it('accepts filter lists at their limits', () => {
      expect(
        areCollectionFilterListsWithinLimits({
          tags: Array(MAX_COLLECTION_FILTER_TAGS).fill('tag'),
          genres: Array(MAX_COLLECTION_FILTER_GENRES).fill('genre'),
        })
      ).toBe(true);
    });

    it.each([
      { tags: Array(MAX_COLLECTION_FILTER_TAGS + 1).fill('tag') },
      { genres: Array(MAX_COLLECTION_FILTER_GENRES + 1).fill('genre') },
    ])('rejects filter lists over their limits', (filters) => {
      expect(areCollectionFilterListsWithinLimits(filters)).toBe(false);
    });
  });
});
