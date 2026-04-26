import { getParserRegexp } from '../parser-util';

export const getIMDbRate = (content: string): string =>
  getParserRegexp('IMDbRate').exec(content)?.groups?.['rate'] ?? 'N/A';
