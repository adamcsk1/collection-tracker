// ?? This model contains only the necessary properties
export interface MemoModel {
  content: string;
  name: string;
}

export type MemosModel = Array<MemoModel>;

export interface ApiResponseModel {
  memos: MemosModel;
  nextPageToken: string;
}

export type MemosLoadNetworkStatus = 'pending' | 'error' | 'finished' | null;
