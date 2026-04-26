import { ParserConfigApiResponseModel } from '../models/api-model';
import { restoreSerializedParserRegexp } from '../utils/parser-serialize-util';
import { setParserFilenamePattern, setParserRegexp, setParserTemplate } from './parser-util';

export const applyParserConfig = (parserConfig: ParserConfigApiResponseModel): void => {
  setParserTemplate(parserConfig.mdTemplate!);
  setParserFilenamePattern(parserConfig.filenamePattern!);
  setParserRegexp('IMDbId', restoreSerializedParserRegexp(parserConfig.IMDbId!));
  setParserRegexp('genre', restoreSerializedParserRegexp(parserConfig.genre!));
  setParserRegexp('genreToken', restoreSerializedParserRegexp(parserConfig.genreToken!));
  setParserRegexp('image', restoreSerializedParserRegexp(parserConfig.image!));
  setParserRegexp('IMDbRate', restoreSerializedParserRegexp(parserConfig.IMDbRate!));
  setParserRegexp('tags', restoreSerializedParserRegexp(parserConfig.tags!));
  setParserRegexp('tagToken', restoreSerializedParserRegexp(parserConfig.tagToken!));
  setParserRegexp('title', restoreSerializedParserRegexp(parserConfig.title!));
  setParserRegexp('year', restoreSerializedParserRegexp(parserConfig.year!));
  setParserRegexp('content', restoreSerializedParserRegexp(parserConfig.content!));
};
