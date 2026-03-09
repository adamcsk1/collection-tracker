import { beforeEach, describe, expect, it } from 'vitest';
import { PARSER_REGEXPS } from '@shared/constants/parser-const';
import { setParserRegexp } from '@services/parser/parser-util';
import { addNewTagToRawContent, removeTagFromRawContent } from './manage-tags-util';

beforeEach(() => {
  setParserRegexp('tags', PARSER_REGEXPS.tags);
  setParserRegexp('tagToken', PARSER_REGEXPS.tagToken);
});

describe('manage-tags-util', () => {
  it('appends a new tag to the first tag position in raw content', () => {
    const rawContent = '**Tags** #alpha #beta';

    const updatedContent = addNewTagToRawContent(rawContent, '#watched');

    expect(updatedContent).toBe('**Tags** #alpha #beta #watched');
  });

  it('returns null when tags can not be modified because section is missing', () => {
    const rawContent = '**Year** 2020\n**Genre** action';

    const updatedContent = addNewTagToRawContent(rawContent, '#watched');

    expect(updatedContent).toBeNull();
  });

  it('returns null when tags section has no first tag token', () => {
    const rawContent = '**Tags**   \n**Genre** action';

    const updatedContent = addNewTagToRawContent(rawContent, '#watched');

    expect(updatedContent).toBe(`${rawContent} #watched`);
  });

  it('removes all matching tags in raw content', () => {
    const rawContent = '**Tags** #alpha #watched #beta #watched';

    const updatedContent = removeTagFromRawContent(rawContent, '#watched');

    expect(updatedContent).toBe('**Tags** #alpha  #beta ');
  });
});
