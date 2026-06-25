ALTER TABLE collection_items ADD COLUMN watched_at TEXT;

UPDATE collection_items
SET watched_at = created_at
WHERE list_type = 'movie-tracker';

UPDATE collection_items
SET watched_at = updated_at
WHERE list_type = 'series-tracker'
  AND EXISTS (
    SELECT 1
    FROM collection_item_tags
    WHERE collection_item_tags.item_id = collection_items.id
      AND collection_item_tags.tag = '#completed'
  );

CREATE INDEX IF NOT EXISTS idx_collection_items_watched_at ON collection_items(username_hash, list_type, watched_at);
