import { getParserRegexp, setParserRegexp } from '@services/parser/parser-util';
import { PARSER_REGEXPS } from '@shared/constants/parser-const';
import { beforeAll, describe, expect, it } from 'vitest';
import { getCollectionItem } from './get-collection-item-util';

beforeAll(() => {
  setParserRegexp('image', getParserRegexp('image') ?? PARSER_REGEXPS.image);
  setParserRegexp('title', getParserRegexp('title') ?? PARSER_REGEXPS.title);
  setParserRegexp('IMDbId', getParserRegexp('IMDbId') ?? PARSER_REGEXPS.IMDbId);
  setParserRegexp('IMDbRate', getParserRegexp('IMDbRate') ?? PARSER_REGEXPS.IMDbRate);
  setParserRegexp('genre', getParserRegexp('genre') ?? PARSER_REGEXPS.genre);
  setParserRegexp('genreToken', getParserRegexp('genreToken') ?? PARSER_REGEXPS.genreToken);
  setParserRegexp('tags', getParserRegexp('tags') ?? PARSER_REGEXPS.tags);
  setParserRegexp('tagToken', getParserRegexp('tagToken') ?? PARSER_REGEXPS.tagToken);
  setParserRegexp('year', getParserRegexp('year') ?? PARSER_REGEXPS.year);
});

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
