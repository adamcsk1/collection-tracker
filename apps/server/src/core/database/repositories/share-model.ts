export interface UserShareRow {
  id: number;
  owner_username_hash: string;
  shared_with_username_hash: string;
  can_read: number;
  can_create: number;
  can_update: number;
  can_delete: number;
  created_at: string;
}
