export const buildIMDbUrl = (imdbId: string): string => `https://www.imdb.com/title/${imdbId}/`;

export const buildTrailerUrl = (title: string, year: string | number | null): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${year ?? ''} trailer`.trim())}`;

export const buildIMDbSearchUrl = (searchText: string): string =>
  `https://www.imdb.com/find/?q=${encodeURIComponent(searchText.trim())}`;

export const buildWebSearchUrl = (title: string, year: string | number | null): string =>
  `https://duckduckgo.com/?q=${encodeURIComponent(`${title} ${year ?? ''}`.trim())}`;
