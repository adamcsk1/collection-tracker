import { getParserRegexp } from '@services/parser/parser-util';

export const getTags = (content: string): string[] => {
  const tags = getParserRegexp('tags').exec(content)?.groups?.['tags'];
  return tags ? (tags.match(getParserRegexp('tagToken')) ?? []) : [];
};
