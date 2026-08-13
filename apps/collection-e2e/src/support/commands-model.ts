export interface AuthCookie {
  name: string;
  value: string;
}

export interface CollectionCleanupItem {
  externalProvider: string;
  externalItemId: string;
  hash: string;
  listType?: string;
}

export interface CollectionPageResponse {
  data: CollectionCleanupItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}
