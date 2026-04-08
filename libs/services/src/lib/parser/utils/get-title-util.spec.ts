import { getParserRegexp, setParserRegexp } from '../parser-util';
import { PARSER_REGEXPS } from '@shared/constants/parser-const';
import { beforeAll, describe, expect, it } from 'vitest';
import { getTitle } from './get-title-util';

const contentWithTitle = ['### My Movie', '**Genre**', 'Action'].join('\n');

describe('getTitle', () => {
  beforeAll(() => {
    setParserRegexp('title', getParserRegexp('title') ?? PARSER_REGEXPS.title);
  });

  it('extracts the heading text after hashes', () => {
    expect(getTitle(contentWithTitle)).toBe('My Movie');
  });

  it('returns an empty string when the heading is missing', () => {
    expect(getTitle('no heading here')).toBe('');
  });
});
