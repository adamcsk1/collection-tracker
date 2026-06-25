ALTER TABLE collection_items ADD COLUMN content_type TEXT NOT NULL DEFAULT 'movie' CHECK (content_type IN ('movie', 'series'));
ALTER TABLE collection_items ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1));

UPDATE collection_items
SET content_type = 'series'
WHERE EXISTS (
  SELECT 1
  FROM collection_item_tags
  WHERE collection_item_tags.item_id = collection_items.id
    AND collection_item_tags.tag = '#series'
);

UPDATE collection_items
SET content_type = 'movie'
WHERE EXISTS (
  SELECT 1
  FROM collection_item_tags
  WHERE collection_item_tags.item_id = collection_items.id
    AND collection_item_tags.tag = '#movie'
);

UPDATE collection_items
SET favorite = 1
WHERE EXISTS (
  SELECT 1
  FROM collection_item_tags
  WHERE collection_item_tags.item_id = collection_items.id
    AND collection_item_tags.tag = '#favorite'
);

CREATE INDEX IF NOT EXISTS idx_collection_items_content_type ON collection_items(username_hash, list_type, content_type);
CREATE INDEX IF NOT EXISTS idx_collection_items_favorite ON collection_items(username_hash, list_type, favorite);
