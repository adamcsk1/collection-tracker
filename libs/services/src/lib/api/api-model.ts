export type ApiLoadNetworkStatus = 'pending' | 'error' | 'finished' | null;

export interface ApiGetAllItemModel {
  name: string;
  content: string;
}

export type ApiGetAllModel = Array<ApiGetAllItemModel>;

export interface ApiCreateModel {
  name: string;
}

export interface ApiModifyModel {
  name: string;
}
