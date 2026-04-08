import { CollectionItemModel } from '../../collection-model';
import { VIRTUAL_UNWATCHED_TAG, WATCHED_TAG } from '@shared/constants/tags-const';
import { FUZZY_CONTENT_MAX_LENGTH } from '@shared/utils/fuzzy-search-util';
import { describe, expect, it } from 'vitest';
import { matchesSearch } from './matches-search-util';

const buildItem = (overrides: { title?: string; rawContent?: string; tags?: string[] } = {}): CollectionItemModel => {
  const rawContent = overrides.rawContent ?? '';
  const title = overrides.title ?? '';
  return {
    rawContent,
    rawContentLower: rawContent.toLowerCase(),
    image: '',
    title,
    titleLower: title.toLowerCase(),
    genre: [],
    IMDbId: '',
    tags: overrides.tags ?? [],
    name: '',
    year: null,
    rate: '',
    hash: '',
  };
};

describe('matchesSearch — virtual unwatched tag', () => {
  it('returns true when item does not contain the watched tag', () => {
    const item = buildItem({ rawContent: 'some content #action' });
    expect(matchesSearch(item, VIRTUAL_UNWATCHED_TAG, false)).toBe(true);
  });

  it('returns false when item contains the watched tag', () => {
    const item = buildItem({ rawContent: `some content ${WATCHED_TAG}` });
    expect(matchesSearch(item, VIRTUAL_UNWATCHED_TAG, false)).toBe(false);
  });
});

describe('matchesSearch — non-fuzzy', () => {
  it('returns true when rawContentLower includes the search text', () => {
    const item = buildItem({ rawContent: 'Action movie about space' });
    expect(matchesSearch(item, 'space', false)).toBe(true);
  });

  it('is case-insensitive when matching raw content', () => {
    const item = buildItem({ rawContent: 'Action Movie About Space' });
    expect(matchesSearch(item, 'SPACE', false)).toBe(true);
  });

  it('returns false when rawContentLower does not include the search text', () => {
    const item = buildItem({ rawContent: 'Drama about love' });
    expect(matchesSearch(item, 'space', false)).toBe(false);
  });
});

describe('matchesSearch — fuzzy search', () => {
  it('returns true on exact title match without fuzzy', () => {
    const item = buildItem({ title: 'Hello World', rawContent: 'some content' });
    expect(matchesSearch(item, 'hello', true)).toBe(true);
  });

  it('returns true on near-match in title (one character different)', () => {
    const item = buildItem({ title: 'Hello World', rawContent: 'unrelated content' });
    // "hellp" is 1 edit away from "hello"
    expect(matchesSearch(item, 'hellp', true)).toBe(true);
  });

  it('returns true when rawContentLower includes the exact search text', () => {
    const item = buildItem({ title: 'Unrelated', rawContent: 'Action movie with drama' });
    expect(matchesSearch(item, 'action', true)).toBe(true);
  });

  it('returns true on near-match in short content (length <= FUZZY_CONTENT_MAX_LENGTH)', () => {
    const content = 'a short description ending with hellp';
    expect(content.length).toBeLessThanOrEqual(FUZZY_CONTENT_MAX_LENGTH);
    const item = buildItem({ title: 'Unrelated', rawContent: content });
    // "hello" is 1 edit from "hellp"
    expect(matchesSearch(item, 'hello', true)).toBe(true);
  });

  it('returns false when content exceeds FUZZY_CONTENT_MAX_LENGTH and has no exact match', () => {
    const longContent = 'z'.repeat(FUZZY_CONTENT_MAX_LENGTH + 1);
    const item = buildItem({ title: 'xyz', rawContent: longContent });
    expect(matchesSearch(item, 'hello', true)).toBe(false);
  });
});
