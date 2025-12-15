import { WindowParserCacheModel } from '@services/parser/parser-model';
import { PARSER_REGEXPS } from '@shared/constants/parser-const';

const parserWindow = window as WindowParserCacheModel;

if (parserWindow.__parserCache === undefined) parserWindow.__parserCache = {};

const parserCache = parserWindow.__parserCache;

export const getParserTemplate = (): string => parserCache.mdTemplate!;

export const getParserRegexp = (key: keyof typeof PARSER_REGEXPS): RegExp => parserCache[key]!;

export const setParserTemplate = (template: string): void => {
  parserCache.mdTemplate = template;
};

export const setParserRegexp = (key: keyof typeof PARSER_REGEXPS, regexp: RegExp): void => {
  parserCache[key] = regexp;
};
