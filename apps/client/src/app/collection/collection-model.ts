export interface CollectionItemModel {
  rawContent: string;
  image: string;
  title: string;
  genre: Array<string>;
  IMDbId: string;
  tags: Array<string>;
  name: string;
  year: number | null;
}

export type CollectionModel = Array<CollectionItemModel>;
