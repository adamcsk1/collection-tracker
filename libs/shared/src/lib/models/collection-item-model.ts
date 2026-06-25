export type CollectionListTypeModel = 'library' | 'watch-later' | 'wishlist' | 'series-tracker' | 'movie-tracker';
export type CollectionItemYearModel = string | null;

export interface CollectionItemModel {
  image: string;
  title: string;
  titleLower: string; // The lowercase cached version of title for faster searching.
  genre: string[];
  IMDbId: string;
  tags: string[];
  year: CollectionItemYearModel;
  rate: string;
  rottenTomatoesRate: string;
  metacriticRate: string;
  userRate: number | null;
  hash: string;
  actors: string;
  plot: string;
  listType: CollectionListTypeModel;
  watched?: boolean;
  watchedAt: string | null;
  ownerShareCode?: string;
}

export type CollectionModel = CollectionItemModel[];
