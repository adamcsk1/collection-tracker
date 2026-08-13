export interface CollectionCursorPayload {
  version: 1;
  kind: 'collection';
  sortValue: string;
  rowId: number;
  filterHash: string;
}

export interface MatchesCursorPayload {
  version: 1;
  kind: 'matches';
  rank: number;
  rowId: number;
  filterHash: string;
}

export type CursorPayload = CollectionCursorPayload | MatchesCursorPayload;
