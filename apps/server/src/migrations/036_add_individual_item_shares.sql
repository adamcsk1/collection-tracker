-- Add explicit read modes and owner-enforced physical item selections.

BEGIN IMMEDIATE;

ALTER TABLE user_share_grants
  ADD COLUMN scope_mode TEXT NOT NULL DEFAULT 'all' CHECK (scope_mode IN ('selected', 'all'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_id_owner
  ON collection_items(id, username_hash);

CREATE TABLE user_share_item_selections (
  owner_username_hash TEXT NOT NULL,
  shared_with_username_hash TEXT NOT NULL,
  collection_item_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_username_hash, shared_with_username_hash, collection_item_id),
  FOREIGN KEY (owner_username_hash, shared_with_username_hash)
    REFERENCES user_shares(owner_username_hash, shared_with_username_hash) ON DELETE CASCADE,
  FOREIGN KEY (collection_item_id, owner_username_hash)
    REFERENCES collection_items(id, username_hash) ON DELETE CASCADE
);

CREATE INDEX idx_user_share_item_selections_recipient
  ON user_share_item_selections(shared_with_username_hash, collection_item_id);
CREATE INDEX idx_user_share_item_selections_item
  ON user_share_item_selections(collection_item_id);

CREATE TRIGGER enforce_selected_grant_before_item_selection_insert
BEFORE INSERT ON user_share_item_selections
WHEN NOT EXISTS (
  SELECT 1
  FROM collection_items item
  INNER JOIN user_share_grants grant_scope
    ON grant_scope.owner_username_hash = NEW.owner_username_hash
   AND grant_scope.shared_with_username_hash = NEW.shared_with_username_hash
   AND grant_scope.list_type = item.list_type
   AND grant_scope.content_type = item.content_type
   AND grant_scope.scope_mode = 'selected'
  WHERE item.id = NEW.collection_item_id
    AND item.username_hash = NEW.owner_username_hash
)
BEGIN
  SELECT RAISE(ABORT, 'item selection requires an exact selected grant');
END;

CREATE TRIGGER enforce_selected_grant_before_item_selection_update
BEFORE UPDATE OF owner_username_hash, shared_with_username_hash, collection_item_id ON user_share_item_selections
WHEN NOT EXISTS (
  SELECT 1
  FROM collection_items item
  INNER JOIN user_share_grants grant_scope
    ON grant_scope.owner_username_hash = NEW.owner_username_hash
   AND grant_scope.shared_with_username_hash = NEW.shared_with_username_hash
   AND grant_scope.list_type = item.list_type
   AND grant_scope.content_type = item.content_type
   AND grant_scope.scope_mode = 'selected'
  WHERE item.id = NEW.collection_item_id
    AND item.username_hash = NEW.owner_username_hash
)
BEGIN
  SELECT RAISE(ABORT, 'item selection requires an exact selected grant');
END;

INSERT INTO schema_migrations (id) VALUES ('036_add_individual_item_shares.sql');

COMMIT;
