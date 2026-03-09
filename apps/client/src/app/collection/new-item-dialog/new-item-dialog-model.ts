export interface NewItemModel {
  searchText: string;
  selectedIMDbId: string | null;
  tags: string;
  watched: boolean;
}

export type SaveMode = 'new' | 'close' | null;
