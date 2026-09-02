const mbid = 'f509c5ff-ad54-4dde-b61e-24f750965835';

export const buildMusicBrainzItem = (title: string, itemMbid = mbid) => ({
  provider: 'musicbrainz',
  providerItemId: itemMbid,
  externalIds: [{ source: 'musicbrainz', id: itemMbid }],
  title,
  year: '1973',
  contentType: 'album',
  poster: '',
  plot: 'A test album description for e2e testing.',
  actors: 'Artist One, Artist Two',
  genres: ['Progressive rock'],
  ratings: [],
});

export const buildMusicBrainzSearchResult = (title: string, itemMbid = mbid) => ({
  results: [buildMusicBrainzItem(title, itemMbid)],
});

export const buildMusicItem = (title: string, itemMbid = mbid) => ({
  image: '',
  title,
  genre: ['Progressive rock'],
  IMDbId: '',
  externalProvider: 'musicbrainz',
  externalItemId: itemMbid,
  externalIds: [{ source: 'musicbrainz', id: itemMbid }],
  tags: [],
  year: '1973',
  rate: '',
  rottenTomatoesRate: '',
  metacriticRate: '',
  userRate: null,
  actors: 'Artist One, Artist Two',
  plot: 'A test album description for e2e testing.',
  contentType: 'album',
  favorite: false,
  listType: 'music',
});
