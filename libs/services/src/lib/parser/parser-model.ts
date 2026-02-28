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
  mdTemplate?: string;
}

declare global {
  interface Window {
    __parserCache?: ParserCacheModel;
  }
}
