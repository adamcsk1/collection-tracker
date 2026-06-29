CREATE TEMP TABLE duplicate_canonical_collection_item_ids AS
  SELECT id
  FROM collection_items
  WHERE canonical_item_id IS NOT NULL
    AND id NOT IN (
      SELECT MIN(id)
      FROM collection_items
      WHERE canonical_item_id IS NOT NULL
      GROUP BY username_hash, canonical_item_id, list_type
    );

DELETE FROM collection_item_genres
WHERE item_id IN (SELECT id FROM duplicate_canonical_collection_item_ids);

DELETE FROM collection_item_tags
WHERE item_id IN (SELECT id FROM duplicate_canonical_collection_item_ids);

DELETE FROM series_tracker_seasons
WHERE item_id IN (SELECT id FROM duplicate_canonical_collection_item_ids);

DELETE FROM series_tracker_watched_episodes
WHERE item_id IN (SELECT id FROM duplicate_canonical_collection_item_ids);

DELETE FROM ai_search_embeddings
WHERE item_id IN (SELECT id FROM duplicate_canonical_collection_item_ids);

DELETE FROM collection_items
WHERE id IN (SELECT id FROM duplicate_canonical_collection_item_ids);

DROP TABLE duplicate_canonical_collection_item_ids;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_unique_canonical_identity
  ON collection_items(username_hash, canonical_item_id, list_type)
  WHERE canonical_item_id IS NOT NULL;
