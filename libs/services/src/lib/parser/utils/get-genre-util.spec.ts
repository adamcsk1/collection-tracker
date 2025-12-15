import { getParserRegexp, setParserRegexp } from '@services/parser/parser-util';
import { PARSER_REGEXPS } from '@shared/constants/parser-const';
import { beforeAll, describe, expect, it } from 'vitest';
import { getGenre } from './get-genre-util';

const contentWithGenres = [
  '### My Movie',
  '**Genre**',
  'Action, Comedy, Drama',
  '**Actors**',
  'Actor One, Actor Two',
].join('\n');

describe('getGenre', () => {
  beforeAll(() => {
    setParserRegexp('genre', getParserRegexp('genre') ?? PARSER_REGEXPS.genre);
    setParserRegexp('genreToken', getParserRegexp('genreToken') ?? PARSER_REGEXPS.genreToken);
  });

  it('return with the genre array', () => {
    expect(getGenre(contentWithGenres)).toEqual(['Action', 'Comedy', 'Drama']);
  });

  it('returns an empty array when the genre block is not present', () => {
    expect(getGenre('**Actors**\nNo genres listed')).toEqual([]);
  });
});
