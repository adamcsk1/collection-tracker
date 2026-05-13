export interface NewItemModel {
  searchText: string;
  selectedIMDbId: string | null;
  tags: string;
  watched: boolean;
  targetOwnerShareCode: string | null;
}

export type SaveMode = 'new' | 'close' | null;
