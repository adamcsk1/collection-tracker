BEGIN;

CREATE INDEX IF NOT EXISTS idx_collection_items_list_title_id
  ON collection_items(username_hash, list_type, title_lower, id);

INSERT INTO schema_migrations (id) VALUES ('035_add_collection_cursor_indexes.sql');

COMMIT;
