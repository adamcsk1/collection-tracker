import type {
  CollectionItemContentTypeModel,
  CollectionListTypeModel,
  UserShareGrantApiModel,
} from '@shared/models/api-model';

export interface UserShareGrantRow {
  id: number;
  owner_username_hash: string;
  shared_with_username_hash: string;
  list_type: CollectionListTypeModel;
  content_type: CollectionItemContentTypeModel;
  can_read: number;
  can_create: number;
  can_update: number;
  can_delete: number;
}

export interface UserShareDetailsRow {
  share_id: number;
  direction: 'incoming' | 'outgoing';
  owner_username_hash: string;
  shared_with_username_hash: string;
  counterpart_username: string | null;
  grant_id: number | null;
  list_type: CollectionListTypeModel | null;
  content_type: CollectionItemContentTypeModel | null;
  can_read: number | null;
  can_create: number | null;
  can_update: number | null;
  can_delete: number | null;
}

export interface UserShareDetailsModel {
  direction: UserShareDetailsRow['direction'];
  ownerUsernameHash: string;
  sharedWithUsernameHash: string;
  counterpartUsername: string | null;
  grants: UserShareGrantApiModel[];
}
