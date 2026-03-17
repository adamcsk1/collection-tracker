import { getParserRegexp } from '@services/parser/parser-util';

export const getContent = (content: string): string =>
  getParserRegexp('content').exec(content)?.groups?.['content'] ?? '';
