export interface CollectionItemModel {
  image: string;
  title: string;
  titleLower: string; // The lowercase cached version of title for faster searching.
  genre: string[];
  IMDbId: string;
  tags: string[];
  year: number | null;
  rate: string;
  hash: string;
  actors: string;
  plot: string;
  ownerShareCode?: string;
}

export type CollectionModel = CollectionItemModel[];
