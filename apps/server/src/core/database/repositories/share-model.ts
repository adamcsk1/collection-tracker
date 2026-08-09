import type { CollectionItemContentTypeModel, CollectionListTypeModel } from '@shared/models/api-model';

export interface UserShareRow {
  id: number;
  owner_username_hash: string;
  shared_with_username_hash: string;
  created_at: string;
}

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
