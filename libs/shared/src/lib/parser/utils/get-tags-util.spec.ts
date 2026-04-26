import { getParserRegexp, setParserRegexp } from '../parser-util';
import { PARSER_REGEXPS } from '../../constants/parser-const';
import { beforeAll, describe, expect, it } from 'vitest';
import { getTags } from './get-tags-util';

beforeAll(() => {
  setParserRegexp('tags', getParserRegexp('tags') ?? PARSER_REGEXPS.tags);
  setParserRegexp('tagToken', getParserRegexp('tagToken') ?? PARSER_REGEXPS.tagToken);
});

describe('getTags', () => {
  it('return with the tags array', () => {
    const content = ['**Tags**', ' tag-one  tag-two   tag-three  '].join('\n');
    expect(getTags(content)).toEqual(['tag-one', 'tag-two', 'tag-three']);
  });

  it('returns an empty array when tags are not provided', () => {
    expect(getTags('no tags here')).toEqual([]);
  });
});
