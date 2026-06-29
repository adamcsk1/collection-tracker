type ItemType = 'movie' | 'series';

interface CollectionItemFixture {
  image: string;
  title: string;
  genre: string[];
  IMDbId: string;
  externalProvider: string;
  externalItemId: string;
  tags: string[];
  year: string | null;
  rate: string;
  rottenTomatoesRate: string;
  metacriticRate: string;
  userRate: number | null;
  actors: string;
  plot: string;
  contentType: ItemType;
  favorite: boolean;
}

export const buildCollectionItem = (
  title: string,
  type: ItemType = 'movie',
  imdbId = 'tt1234567'
): CollectionItemFixture => ({
  image: '',
  title,
  genre: ['Action', 'Adventure'],
  IMDbId: imdbId,
  externalProvider: 'omdb',
  externalItemId: imdbId,
  tags: [],
  year: '2020',
  rate: '8.5',
  rottenTomatoesRate: '',
  metacriticRate: '',
  userRate: null,
  actors: 'Actor One, Actor Two',
  plot: `A great ${type} for e2e testing.`,
  contentType: type,
  favorite: false,
});

export const buildCollectionItems = (titles: string[], type: ItemType = 'movie'): CollectionItemFixture[] =>
  titles.map((title, index) => buildCollectionItem(title, type, `tt${1000000 + index}`));
