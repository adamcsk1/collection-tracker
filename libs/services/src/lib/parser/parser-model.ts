export interface ParserCacheModel {
  IMDbId?: RegExp;
  genre?: RegExp;
  genreToken?: RegExp;
  image?: RegExp;
  IMDbRate?: RegExp;
  tags?: RegExp;
  tagToken?: RegExp;
  title?: RegExp;
  year?: RegExp;
  content?: RegExp;
  mdTemplate?: string;
  filenamePattern?: string;
}

declare global {
  interface Window {
    __parserCache?: ParserCacheModel;
  }
}
