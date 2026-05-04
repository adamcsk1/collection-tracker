import { CollectionItemModel } from '../collection-model';
import { describe, expect, it, vi } from 'vitest';
import { searchCollection } from './search-collection-util';

const buildItem = (overrides: Partial<CollectionItemModel> = {}): CollectionItemModel => ({
  image: '',
  title: '',
  titleLower: '',
  searchableTextLower: '',
  genre: [],
  IMDbId: '',
  tags: [],
  year: null,
  rate: '',
  hash: '',
  actors: '',
  plot: '',
  ...overrides,
});

describe('searchCollection', () => {
  it('returns an empty set when the collection is empty', () => {
    const result = searchCollection([], 5, () => {});

    expect(result.size).toBe(0);
  });

  it('calls the matcher for each item until the limit is reached', () => {
    const items = [buildItem({ title: 'A' }), buildItem({ title: 'B' }), buildItem({ title: 'C' })];
    const matcher = vi.fn((item: CollectionItemModel, results: Set<string>) => results.add(item.title));

    searchCollection(items, 2, matcher);

    expect(matcher).toHaveBeenCalledTimes(2);
  });

  it('collects results added by the matcher', () => {
    const items = [buildItem({ title: 'Alpha' }), buildItem({ title: 'Beta' })];

    const result = searchCollection(items, 10, (item, results) => results.add(item.title));

    expect(result).toEqual(new Set(['Alpha', 'Beta']));
  });

  it('stops iterating once the limit is reached', () => {
    const items = [buildItem({ title: 'A' }), buildItem({ title: 'B' }), buildItem({ title: 'C' })];

    const result = searchCollection(items, 2, (item, results) => results.add(item.title));

    expect(result.size).toBe(2);
    expect(result.has('C')).toBe(false);
  });

  it('does not iterate when the collection is empty regardless of limit', () => {
    const matcher = vi.fn();

    searchCollection([], 0, matcher);

    expect(matcher).not.toHaveBeenCalled();
  });

  it('does not add duplicate entries to the result set', () => {
    const items = [buildItem({ tags: ['#action'] }), buildItem({ tags: ['#action'] })];

    const result = searchCollection(items, 10, (item, results) => {
      for (const tag of item.tags) results.add(tag);
    });

    expect(result.size).toBe(1);
    expect(result.has('#action')).toBe(true);
  });
});
