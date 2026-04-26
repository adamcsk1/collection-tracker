import { getParserRegexp, setParserRegexp } from '../parser/parser-util';
import { PARSER_REGEXPS } from '../constants/parser-const';
import { beforeAll } from 'vitest';
import { getIMDbId } from './get-imdb-id-util';

beforeAll(() => {
  // Seed parser cache with default IMDbId regexp for isolated test environment
  setParserRegexp('IMDbId', getParserRegexp('IMDbId') ?? PARSER_REGEXPS.IMDbId);
});

describe('getIMDbId', () => {
  it('extracts the IMDb id when present', () => {
    expect(getIMDbId('[IMDb (tt0374455)](https://www.imdb.com/title/tt0374455/) (**8.1** / 10)')).toBe('tt0374455');
  });

  it('returns empty string when no id is present', () => {
    expect(getIMDbId('No id here')).toBe('');
  });
});
