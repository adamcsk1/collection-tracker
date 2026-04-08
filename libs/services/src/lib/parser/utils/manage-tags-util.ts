import { getParserRegexp } from '../parser-util';
import { PARSER_REGEXPS } from '@shared/constants/parser-const';

export const addNewTagToRawContent = (rawContent: string, newTag: string): string | null => {
  const tagsRegexp = getParserRegexp('tags') || PARSER_REGEXPS.tags;
  const tagTokenRegexp = getParserRegexp('tagToken') || PARSER_REGEXPS.tagToken;

  const tagsRawContent = tagsRegexp.exec(rawContent)?.[0];
  if (!tagsRawContent) return null;

  const tagsContent = tagsRegexp.exec(rawContent)?.groups?.['tags'] || '';
  const extractedTagToken = tagsContent.split(tagTokenRegexp).filter(Boolean)[0] || ' ';

  return rawContent.replace(
    tagsRawContent,
    `${tagsRawContent}${tagsRawContent.at(-1) !== extractedTagToken ? `${extractedTagToken}${newTag}` : newTag}`
  );
};

export const removeTagFromRawContent = (rawContent: string, tagToRemove: string): string =>
  rawContent.replace(new RegExp(tagToRemove, 'g'), '');
