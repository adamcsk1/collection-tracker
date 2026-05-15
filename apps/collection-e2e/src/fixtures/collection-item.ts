type ItemType = 'movie' | 'series';

interface CollectionItemFixture {
  image: string;
  title: string;
  genre: string[];
  IMDbId: string;
  tags: string[];
  year: number | null;
  rate: string;
  userRate: number | null;
  actors: string;
  plot: string;
}

export const buildCollectionItem = (
  title: string,
  type: ItemType = 'movie',
  imdbId = 'tt1234567'
): CollectionItemFixture => ({
  image: 'https://placehold.co/90x133',
  title,
  genre: ['Action', 'Adventure'],
  IMDbId: imdbId,
  tags: [`#${type}`],
  year: 2020,
  rate: '8.5',
  userRate: null,
  actors: 'Actor One, Actor Two',
  plot: `A great ${type} for e2e testing.`,
});

export const buildCollectionItems = (titles: string[], type: ItemType = 'movie'): CollectionItemFixture[] =>
  titles.map((title, index) => buildCollectionItem(title, type, `tt${1000000 + index}`));
