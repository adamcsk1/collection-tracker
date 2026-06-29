export const buildOmdbSearchResult = (title: string, imdbId = 'tt1234567', type = 'movie') => ({
  results: [
    {
      provider: 'omdb',
      providerItemId: imdbId,
      title,
      year: '2020',
      contentType: type,
      poster: 'N/A',
      plot: 'A test plot for e2e testing.',
      actors: 'Actor One, Actor Two',
      genres: ['Action', 'Adventure'],
      ratings: [{ source: 'Internet Movie Database', value: '8.5' }],
    },
  ],
});

export const buildOmdbItem = (title: string, imdbId = 'tt1234567', type = 'movie') => ({
  provider: 'omdb',
  providerItemId: imdbId,
  title,
  year: '2020',
  contentType: type,
  poster: 'N/A',
  plot: 'A test plot for e2e testing.',
  actors: 'Actor One, Actor Two',
  genres: ['Action', 'Adventure'],
  ratings: [{ source: 'Internet Movie Database', value: '8.5' }],
});
