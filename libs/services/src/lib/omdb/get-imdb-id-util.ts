import { getParserRegexp } from '@services/parser/parser-util';

export const getIMDbId = (content: string): string => getParserRegexp('IMDbId').exec(content)?.groups?.['id'] ?? '';
