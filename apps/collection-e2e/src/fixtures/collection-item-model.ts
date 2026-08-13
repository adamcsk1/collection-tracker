export type ItemType = 'movie' | 'series';
export type ListType = 'library' | 'up-next' | 'wishlist' | 'tracking' | 'books';

export interface CollectionItemFixture {
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
  listType?: ListType;
}
