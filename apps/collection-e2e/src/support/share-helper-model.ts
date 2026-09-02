export type ShareListType = 'library' | 'books' | 'music' | 'wishlist' | 'up-next' | 'tracking';
export type ShareContentType = 'movie' | 'series' | 'book' | 'album';
export type SharePermissionKey = 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete';
export type ShareReadMode = 'none' | 'selected' | 'all';
export type ShareGrantReadMode = Exclude<ShareReadMode, 'none'>;

export interface ShareGrant {
  listType: ShareListType;
  contentType: ShareContentType;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  readMode: ShareGrantReadMode;
}

export interface SharePermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface ItemShareSelection {
  sharedWithUserShareCode: string;
  permissions: SharePermissions;
}

export interface ItemShareState {
  sharedWithUserShareCode: string;
  sharedWithUsername: string | null;
  readMode: ShareReadMode;
  permissions: SharePermissions | null;
}

export interface TestUser {
  username: string;
  token: string;
  cookie: string;
  shareCode: string;
}

export interface ApiEnvelope<ResponseData> {
  data: ResponseData;
}

export interface CollectionPageEnvelope<Item> extends ApiEnvelope<Item[]> {
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export interface OutgoingShareResponse {
  outgoing: { sharedWithUserShareCode: string; grants: ShareGrant[] }[];
}
