import { getParserRegexp, setParserRegexp } from '@services/parser/parser-util';
import { PARSER_REGEXPS } from '@shared/constants/parser-const';
import { beforeAll, describe, expect, it } from 'vitest';
import { getIMDbRate } from './get-imdb-rate-util';

beforeAll(() => {
  setParserRegexp('IMDbRate', getParserRegexp('IMDbRate') ?? PARSER_REGEXPS.IMDbRate);
});

describe('getIMDbRate', () => {
  it('extracts the numeric IMDb score from content', () => {
    const content = '[IMDb (tt1234567)](https://imdb.example/title/tt1234567) (**8.7** / 10)';
    expect(getIMDbRate(content)).toBe('8.7');
  });

  it('returns an empty string when no IMDb block is present', () => {
    expect(getIMDbRate('no imdb here')).toBe('');
  });
});
