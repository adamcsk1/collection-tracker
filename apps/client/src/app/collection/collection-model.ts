export interface CollectionItemModel {
  rawContent: string;
  rawContentLower: string; // The lowercase cached version of rawContent for faster searching.
  image: string;
  title: string;
  titleLower: string; // The lowercase cached version of title for faster searching.
  genre: string[];
  IMDbId: string;
  tags: string[];
  name: string;
  year: number | null;
  rate: string;
}

export type CollectionModel = CollectionItemModel[];
