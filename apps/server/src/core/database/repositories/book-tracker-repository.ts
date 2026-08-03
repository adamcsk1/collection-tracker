import Database from 'better-sqlite3';
import { deleteUnreferencedExternalItemIdentities } from './external-item-identity-repository';

export const deleteAllBookTrackerItems = (db: Database.Database, usernameHash: string): number => {
  const deletedCanonicalItemIds = db
    .prepare('SELECT canonical_item_id FROM collection_items WHERE username_hash = ? AND list_type = ?')
    .all(usernameHash, 'book-tracker') as Array<{ canonical_item_id: string | null }>;
  const result = db
    .prepare('DELETE FROM collection_items WHERE username_hash = ? AND list_type = ?')
    .run(usernameHash, 'book-tracker');
  deleteUnreferencedExternalItemIdentities(
    db,
    usernameHash,
    deletedCanonicalItemIds.map((row) => row.canonical_item_id)
  );
  return result.changes;
};
