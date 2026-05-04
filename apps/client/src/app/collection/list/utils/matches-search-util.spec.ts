import { CollectionItemModel } from '../../collection-model';
import { VIRTUAL_UNWATCHED_TAG, WATCHED_TAG } from '@shared/constants/tags-const';
import { FUZZY_CONTENT_MAX_LENGTH } from '@shared/utils/fuzzy-search-util';
import { describe, expect, it } from 'vitest';
import { matchesSearch } from './matches-search-util';

const buildItem = (
  overrides: { title?: string; searchableTextLower?: string; tags?: string[] } = {}
): CollectionItemModel => {
  const title = overrides.title ?? '';
  return {
    image: '',
    title,
    titleLower: title.toLowerCase(),
    searchableTextLower: overrides.searchableTextLower ?? '',
    genre: [],
    IMDbId: '',
    tags: overrides.tags ?? [],
    year: null,
    rate: '',
    hash: '',
    actors: '',
    plot: '',
  };
};

describe('matchesSearch — virtual unwatched tag', () => {
  it('returns true when item does not contain the watched tag', () => {
    const item = buildItem({ searchableTextLower: 'some content #action' });
    expect(matchesSearch(item, VIRTUAL_UNWATCHED_TAG, false)).toBe(true);
  });

  it('returns false when item has the watched tag', () => {
    const item = buildItem({ searchableTextLower: `some content ${WATCHED_TAG}`, tags: [WATCHED_TAG] });
    expect(matchesSearch(item, VIRTUAL_UNWATCHED_TAG, false)).toBe(false);
  });

  it('returns true when item mentions the watched tag in content but is tagged as unwatched', () => {
    const item = buildItem({
      searchableTextLower: `some content ${WATCHED_TAG} watch-list`,
      tags: [VIRTUAL_UNWATCHED_TAG],
    });
    expect(matchesSearch(item, VIRTUAL_UNWATCHED_TAG, false)).toBe(true);
  });
});

describe('matchesSearch — non-fuzzy', () => {
  it('returns true when searchableTextLower includes the search text', () => {
    const item = buildItem({ searchableTextLower: 'action movie about space' });
    expect(matchesSearch(item, 'space', false)).toBe(true);
  });

  it('is case-insensitive when matching searchable text', () => {
    const item = buildItem({ searchableTextLower: 'action movie about space' });
    expect(matchesSearch(item, 'SPACE', false)).toBe(true);
  });

  it('returns false when searchableTextLower does not include the search text', () => {
    const item = buildItem({ searchableTextLower: 'drama about love' });
    expect(matchesSearch(item, 'space', false)).toBe(false);
  });
});

describe('matchesSearch — fuzzy search', () => {
  it('returns true on exact title match without fuzzy', () => {
    const item = buildItem({ title: 'Hello World', searchableTextLower: 'some content' });
    expect(matchesSearch(item, 'hello', true)).toBe(true);
  });

  it('returns true on near-match in title (one character different)', () => {
    const item = buildItem({ title: 'Hello World', searchableTextLower: 'unrelated content' });
    // "hellp" is 1 edit away from "hello"
    expect(matchesSearch(item, 'hellp', true)).toBe(true);
  });

  it('returns true when searchableTextLower includes the exact search text', () => {
    const item = buildItem({ title: 'Unrelated', searchableTextLower: 'action movie with drama' });
    expect(matchesSearch(item, 'action', true)).toBe(true);
  });

  it('returns true on near-match in short searchable text (length <= FUZZY_CONTENT_MAX_LENGTH)', () => {
    const searchableTextLower = 'a short description ending with hellp';
    expect(searchableTextLower.length).toBeLessThanOrEqual(FUZZY_CONTENT_MAX_LENGTH);
    const item = buildItem({ title: 'Unrelated', searchableTextLower });
    // "hello" is 1 edit from "hellp"
    expect(matchesSearch(item, 'hello', true)).toBe(true);
  });

  it('returns false when searchable text exceeds FUZZY_CONTENT_MAX_LENGTH and has no exact match', () => {
    const longSearchableTextLower = 'z'.repeat(FUZZY_CONTENT_MAX_LENGTH + 1);
    const item = buildItem({ title: 'xyz', searchableTextLower: longSearchableTextLower });
    expect(matchesSearch(item, 'hello', true)).toBe(false);
  });
});
