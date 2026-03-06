import { PARSER_REGEXPS } from '@shared/constants/parser-const';
import { ParserCacheModel } from './parser-model';

const cacheContainer = window as Window & { __parserCache?: ParserCacheModel };
const parserCache: ParserCacheModel = cacheContainer.__parserCache ?? (cacheContainer.__parserCache = {});

export const getParserTemplate = (): string => parserCache.mdTemplate!;

export const getParserRegexp = (key: keyof typeof PARSER_REGEXPS): RegExp => parserCache[key]!;

export const setParserTemplate = (template: string): void => {
  parserCache.mdTemplate = template;
};

export const setParserRegexp = (key: keyof typeof PARSER_REGEXPS, regexp: RegExp): void => {
  parserCache[key] = regexp;
};
