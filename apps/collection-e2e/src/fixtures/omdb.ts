export const buildOmdbSearchResult = (title: string, imdbId = 'tt1234567') => ({
  Search: [{ Title: title, Year: '2020', imdbID: imdbId, Type: 'movie', Poster: 'N/A' }],
  totalResults: '1',
  Response: 'True',
});

export const buildOmdbItem = (title: string, imdbId = 'tt1234567') => ({
  Title: title,
  Year: '2020',
  imdbID: imdbId,
  Type: 'movie',
  Poster: 'https://placehold.co/90x133',
  Genre: 'Action, Adventure',
  Director: 'Test Director',
  Actors: 'Actor One, Actor Two',
  Plot: 'A test plot for e2e testing.',
  imdbRating: '8.5',
  Response: 'True',
});
