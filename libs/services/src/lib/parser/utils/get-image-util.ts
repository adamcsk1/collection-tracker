import { getParserRegexp } from '../parser-util';

export const getImage = (content: string): string => getParserRegexp('image').exec(content)?.groups?.['image'] ?? '';
