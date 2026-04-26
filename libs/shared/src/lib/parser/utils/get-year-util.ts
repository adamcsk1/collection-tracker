import { getParserRegexp } from '../parser-util';

export const getYear = (content: string): number | null => {
  const match = getParserRegexp('year').exec(content)?.groups?.['year'] ?? null;
  return match ? Number(match) : null;
};
