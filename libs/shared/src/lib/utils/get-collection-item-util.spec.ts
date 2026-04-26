import { beforeAll, describe, expect, it } from 'vitest';
import { PARSER_REGEXPS } from '../constants/parser-const';
import { getParserRegexp, setParserRegexp } from '../parser/parser-util';
import { getCollectionItem } from './get-collection-item-util';

const markdownContent = [
  '### My Movie',
  '[poster|90](https://image.example/poster.jpg)',
  '**Genre**',
  'Action, Comedy',
  '**Actors**',
  'Actor One, Actor Two',
  '**Year**',
  '2021',
  '**Tags**',
  'tag-one tag-two',
  '[IMDb (tt1234567)](https://imdb.example/title/tt1234567) (**8.7** / 10)',
].join('\n');

beforeAll(() => {
  for (const key of Object.keys(PARSER_REGEXPS) as (keyof typeof PARSER_REGEXPS)[]) {
    setParserRegexp(key, getParserRegexp(key) ?? PARSER_REGEXPS[key]);
  }
});

describe('getCollectionItem', () => {
  it('maps markdown content into a collection item model', () => {
    const item = getCollectionItem({ content: markdownContent, name: 'My Movie', hash: 'abc123' });

    expect(item.rawContent).toBe(markdownContent);
    expect(item.image).toBe('https://image.example/poster.jpg');
    expect(item.title).toBe('My Movie');
    expect(item.genre).toEqual(['Action', 'Comedy']);
    expect(item.tags).toEqual(['tag-one', 'tag-two']);
    expect(item.IMDbId).toBe('tt1234567');
    expect(item.year).toBe(2021);
    expect(item.rate).toBe('8.7');
    expect(item.name).toBe('My Movie');
    expect(item.hash).toBe('abc123');
  });

  it('falls back to safe defaults when fields are missing', () => {
    const item = getCollectionItem({});

    expect(item.rawContent).toBe('');
    expect(item.image).toBe('');
    expect(item.title).toBe('');
    expect(item.genre).toEqual([]);
    expect(item.tags).toEqual([]);
    expect(item.IMDbId).toBe('');
    expect(item.year).toBeNull();
    expect(item.rate).toBe('N/A');
    expect(item.name).toBe('');
    expect(item.hash).toBe('');
  });

  it('sets IMDb rate to N/A when the rate is not present', () => {
    const item = getCollectionItem({
      content: ['### My Movie', '**Genre**', 'Action, Comedy', '**Tags**', '#movie'].join('\n'),
      name: 'My Movie',
    });

    expect(item.rate).toBe('N/A');
    expect(item.IMDbId).toBe('');
    expect(item.tags).toEqual(['#movie']);
  });
});
