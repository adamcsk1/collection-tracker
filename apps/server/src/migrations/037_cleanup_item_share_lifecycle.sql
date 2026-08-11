-- Keep selections and selected grants synchronized across direct database mutations.

BEGIN IMMEDIATE;

CREATE TRIGGER enforce_user_share_relationship_before_grant_insert
BEFORE INSERT ON user_share_grants
WHEN NOT EXISTS (
  SELECT 1
  FROM user_shares relationship
  WHERE relationship.owner_username_hash = NEW.owner_username_hash
    AND relationship.shared_with_username_hash = NEW.shared_with_username_hash
)
BEGIN
  SELECT RAISE(ABORT, 'share grant requires an existing user share relationship');
END;

CREATE TRIGGER prevent_user_share_grant_scope_update
BEFORE UPDATE OF owner_username_hash, shared_with_username_hash, list_type, content_type, scope_mode
ON user_share_grants
WHEN OLD.owner_username_hash IS NOT NEW.owner_username_hash
  OR OLD.shared_with_username_hash IS NOT NEW.shared_with_username_hash
  OR OLD.list_type IS NOT NEW.list_type
  OR OLD.content_type IS NOT NEW.content_type
  OR OLD.scope_mode IS NOT NEW.scope_mode
BEGIN
  SELECT RAISE(ABORT, 'share grant identity and scope mode cannot be updated');
END;

CREATE TRIGGER cleanup_item_shares_before_collection_item_delete
BEFORE DELETE ON collection_items
BEGIN
  DELETE FROM user_share_item_selections WHERE collection_item_id = OLD.id;
  DELETE FROM user_share_grants
  WHERE owner_username_hash = OLD.username_hash
    AND list_type = OLD.list_type
    AND content_type = OLD.content_type
    AND scope_mode = 'selected'
    AND NOT EXISTS (
      SELECT 1
      FROM user_share_item_selections remaining
      INNER JOIN collection_items remaining_item ON remaining_item.id = remaining.collection_item_id
      WHERE remaining.owner_username_hash = user_share_grants.owner_username_hash
        AND remaining.shared_with_username_hash = user_share_grants.shared_with_username_hash
        AND remaining_item.list_type = user_share_grants.list_type
        AND remaining_item.content_type = user_share_grants.content_type
    );
END;

CREATE TRIGGER cleanup_item_shares_before_collection_item_scope_change
BEFORE UPDATE OF list_type, content_type ON collection_items
WHEN OLD.list_type != NEW.list_type OR OLD.content_type != NEW.content_type
BEGIN
  DELETE FROM user_share_item_selections WHERE collection_item_id = OLD.id;
  DELETE FROM user_share_grants
  WHERE owner_username_hash = OLD.username_hash
    AND list_type = OLD.list_type
    AND content_type = OLD.content_type
    AND scope_mode = 'selected'
    AND NOT EXISTS (
      SELECT 1
      FROM user_share_item_selections remaining
      INNER JOIN collection_items remaining_item ON remaining_item.id = remaining.collection_item_id
      WHERE remaining.owner_username_hash = user_share_grants.owner_username_hash
        AND remaining.shared_with_username_hash = user_share_grants.shared_with_username_hash
        AND remaining_item.list_type = user_share_grants.list_type
        AND remaining_item.content_type = user_share_grants.content_type
    );
END;

CREATE TRIGGER cleanup_item_selections_after_grant_delete
AFTER DELETE ON user_share_grants
BEGIN
  DELETE FROM user_share_item_selections
  WHERE owner_username_hash = OLD.owner_username_hash
    AND shared_with_username_hash = OLD.shared_with_username_hash
    AND collection_item_id IN (
      SELECT id
      FROM collection_items
      WHERE username_hash = OLD.owner_username_hash
        AND list_type = OLD.list_type
        AND content_type = OLD.content_type
    );
END;

CREATE TRIGGER cleanup_grants_before_user_share_delete
BEFORE DELETE ON user_shares
BEGIN
  DELETE FROM user_share_grants
  WHERE owner_username_hash = OLD.owner_username_hash
    AND shared_with_username_hash = OLD.shared_with_username_hash;
END;

CREATE TRIGGER prune_empty_selected_grant_after_item_selection_delete
AFTER DELETE ON user_share_item_selections
BEGIN
  DELETE FROM user_share_grants
  WHERE owner_username_hash = OLD.owner_username_hash
    AND shared_with_username_hash = OLD.shared_with_username_hash
    AND scope_mode = 'selected'
    AND EXISTS (
      SELECT 1
      FROM collection_items removed_item
      WHERE removed_item.id = OLD.collection_item_id
        AND removed_item.username_hash = OLD.owner_username_hash
        AND removed_item.list_type = user_share_grants.list_type
        AND removed_item.content_type = user_share_grants.content_type
    )
    AND NOT EXISTS (
      SELECT 1
      FROM user_share_item_selections remaining
      INNER JOIN collection_items remaining_item ON remaining_item.id = remaining.collection_item_id
      WHERE remaining.owner_username_hash = user_share_grants.owner_username_hash
        AND remaining.shared_with_username_hash = user_share_grants.shared_with_username_hash
        AND remaining_item.list_type = user_share_grants.list_type
        AND remaining_item.content_type = user_share_grants.content_type
    );
END;

CREATE TRIGGER prune_empty_old_selected_grant_after_item_selection_update
AFTER UPDATE OF owner_username_hash, shared_with_username_hash, collection_item_id ON user_share_item_selections
WHEN OLD.owner_username_hash != NEW.owner_username_hash
  OR OLD.shared_with_username_hash != NEW.shared_with_username_hash
  OR OLD.collection_item_id != NEW.collection_item_id
BEGIN
  DELETE FROM user_share_grants
  WHERE owner_username_hash = OLD.owner_username_hash
    AND shared_with_username_hash = OLD.shared_with_username_hash
    AND scope_mode = 'selected'
    AND EXISTS (
      SELECT 1
      FROM collection_items old_item
      WHERE old_item.id = OLD.collection_item_id
        AND old_item.username_hash = OLD.owner_username_hash
        AND old_item.list_type = user_share_grants.list_type
        AND old_item.content_type = user_share_grants.content_type
    )
    AND NOT EXISTS (
      SELECT 1
      FROM user_share_item_selections remaining
      INNER JOIN collection_items remaining_item ON remaining_item.id = remaining.collection_item_id
      WHERE remaining.owner_username_hash = user_share_grants.owner_username_hash
        AND remaining.shared_with_username_hash = user_share_grants.shared_with_username_hash
        AND remaining_item.list_type = user_share_grants.list_type
        AND remaining_item.content_type = user_share_grants.content_type
    );
END;

INSERT INTO schema_migrations (id) VALUES ('037_cleanup_item_share_lifecycle.sql');

COMMIT;
