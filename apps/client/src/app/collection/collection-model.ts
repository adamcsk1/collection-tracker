export interface CollectionItemModel {
  rawContent: string;
  rawContentLower: string; // The lowercase cached version of rawContent for faster searching.
  image: string;
  title: string;
  titleLower: string; // The lowercase cached version of title for faster searching.
  genre: Array<string>;
  IMDbId: string;
  tags: Array<string>;
  name: string;
  year: number | null;
  rate: string;
}

export type CollectionModel = Array<CollectionItemModel>;
