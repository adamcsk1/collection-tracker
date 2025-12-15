import { getParserRegexp } from '@services/parser/parser-util';

export const getIMDbRate = (content: string): string =>
  getParserRegexp('IMDbRate').exec(content)?.groups?.['rate'] ?? '';
