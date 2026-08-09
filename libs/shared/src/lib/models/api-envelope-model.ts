export interface ApiResponseModel<T> {
  data: T;
}

export type CursorPageModel =
  { limit: number; hasMore: true; nextCursor: string } | { limit: number; hasMore: false; nextCursor: null };

export interface PaginatedApiResponseModel<T> {
  data: T[];
  page: CursorPageModel;
}

export interface ApiProblemModel {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance: string;
}
