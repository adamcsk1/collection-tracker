import { getParserRegexp } from '../parser-util';

export const getGenre = (content: string): string[] => {
  const genre = getParserRegexp('genre').exec(content)?.groups?.['genre'];
  return genre ? (genre.match(getParserRegexp('genreToken')) ?? []) : [];
};
