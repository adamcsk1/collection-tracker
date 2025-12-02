export interface NewItemModel {
  searchText: string;
  selectedIMDbId: string | null;
  tags: string;
}

export type SaveMode = 'new' | 'close' | null;
