import { getParserRegexp } from '../parser-util';

export const getContent = (content: string): string =>
  getParserRegexp('content').exec(content)?.groups?.['content'] ?? '';
