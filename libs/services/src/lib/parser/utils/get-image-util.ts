import { getParserRegexp } from '@services/parser/parser-util';

export const getImage = (content: string): string => getParserRegexp('image').exec(content)?.groups?.['image'] ?? '';
