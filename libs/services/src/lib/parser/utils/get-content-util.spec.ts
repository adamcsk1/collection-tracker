import { getParserRegexp, setParserRegexp } from '@services/parser/parser-util';
import { PARSER_REGEXPS } from '@shared/constants/parser-const';
import { beforeAll, describe, expect, it } from 'vitest';
import { getContent } from './get-content-util';

const contentWithPlot = [
  '### My Movie',
  '[IMDb (tt1234567)](https://www.imdb.com/title/tt1234567/) (**8.7** / 10)',
  'Neo discovers the truth about the Matrix.',
].join('\n');

const contentWithoutImdbLine = ['### My Movie', 'No IMDb link here.'].join('\n');

describe('getContent', () => {
  beforeAll(() => {
    setParserRegexp('content', getParserRegexp('content') ?? PARSER_REGEXPS.content);
  });

  it('extracts the line following the IMDb URL line', () => {
    expect(getContent(contentWithPlot)).toBe('Neo discovers the truth about the Matrix.');
  });

  it('returns an empty string when no IMDb URL line is present', () => {
    expect(getContent(contentWithoutImdbLine)).toBe('');
  });
});
