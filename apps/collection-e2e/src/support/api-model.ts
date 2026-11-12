import type { APIResponse } from '@playwright/test';

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
export interface E2EFixtures {
  api: ApiClient;
  autoLogin: () => Promise<void>;
  autoLoginWithNewUser: () => Promise<void>;
}

export interface ApiClient {
  request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<APIResponse>;
  clearAuth(): void;
}
