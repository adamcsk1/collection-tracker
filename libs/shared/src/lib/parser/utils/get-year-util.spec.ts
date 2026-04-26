import { getParserRegexp, setParserRegexp } from '../parser-util';
import { PARSER_REGEXPS } from '../../constants/parser-const';
import { beforeAll, describe, expect, it } from 'vitest';
import { getYear } from './get-year-util';

beforeAll(() => {
  setParserRegexp('year', getParserRegexp('year') ?? PARSER_REGEXPS.year);
});

describe('getYear', () => {
  it('parses the year line as a number', () => {
    const content = ['**Year**', '2021'].join('\n');
    expect(getYear(content)).toBe(2021);
  });

  it('returns null when the year is missing', () => {
    expect(getYear('**Year**\n')).toBeNull();
  });
});
