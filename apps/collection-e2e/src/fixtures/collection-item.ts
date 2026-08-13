import type { CollectionItemFixture, ItemType, ListType } from './collection-item-model';

export const buildCollectionItem = (
  title: string,
  type: ItemType = 'movie',
  imdbId = 'tt1234567',
  listType?: ListType
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
  ...(listType ? { listType } : {}),
});

export const buildCollectionItems = (titles: string[], type: ItemType = 'movie'): CollectionItemFixture[] =>
  titles.map((title, index) => buildCollectionItem(title, type, `tt${1000000 + index}`));
