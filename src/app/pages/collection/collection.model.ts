export interface CollectionItemModel {
  rawContent: string;
  image: string;
  title: string;
  genre: Array<string>;
  IMDbId: string;
  tags: Array<string>;
  memoName: string;
}

export type CollectionModel = Array<CollectionItemModel>;
