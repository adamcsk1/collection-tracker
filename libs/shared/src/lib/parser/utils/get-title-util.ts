import { getParserRegexp } from '../parser-util';

export const getTitle = (content: string): string => getParserRegexp('title').exec(content)?.groups?.['title'] ?? '';
