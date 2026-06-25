const imdbRatePattern = /^(?:10(?:\.0)?|[0-9](?:\.[0-9])?)$/;
const rottenTomatoesRatePattern = /^(?:100|[1-9]?\d)%$/;
const metacriticRatePattern = /^(?:100|[1-9]?\d)\/100$/;

export const validateOptionalIMDbRateFormat = (value: string) => optionalRateFormatValidation(value, imdbRatePattern);

export const validateOptionalRottenTomatoesRateFormat = (value: string) =>
  optionalRateFormatValidation(value, rottenTomatoesRatePattern);

export const validateOptionalMetacriticRateFormat = (value: string) =>
  optionalRateFormatValidation(value, metacriticRatePattern);

export const isSystemDisplayTag = (): boolean => false;

export const buildTrailerUrl = (title: string, year: string | number | null): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${year ?? ''} trailer`.trim())}`;

export const buildIMDbUrl = (imdbId: string): string => `https://www.imdb.com/title/${imdbId}/`;

export const buildIMDbSearchUrl = (searchText: string): string =>
  `https://www.imdb.com/find/?q=${encodeURIComponent(searchText.trim())}`;

export const buildWebSearchUrl = (title: string, year: string | number | null): string =>
  `https://duckduckgo.com/?q=${encodeURIComponent(`${title} ${year ?? ''}`.trim())}`;

const optionalRateFormatValidation = (value: string, pattern: RegExp) => {
  if (!value) return undefined;
  return pattern.test(value) ? undefined : { kind: 'rateFormat' };
};
