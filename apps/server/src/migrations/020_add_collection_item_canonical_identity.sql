ALTER TABLE collection_items ADD COLUMN canonical_item_id TEXT;

CREATE TABLE IF NOT EXISTS external_item_identities (
  username_hash TEXT NOT NULL,
  canonical_item_id TEXT NOT NULL,
  external_provider TEXT NOT NULL CHECK (external_provider IN ('omdb', 'imdb')),
  external_item_id TEXT NOT NULL,
  source_confidence TEXT NOT NULL DEFAULT 'provider' CHECK (source_confidence IN ('provider', 'fallback')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username_hash, external_provider, external_item_id),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

UPDATE collection_items
SET canonical_item_id = CASE
  WHEN external_provider = 'omdb'
    AND lower(COALESCE(external_item_id, imdb_id, '')) LIKE 'tt%'
    AND substr(lower(COALESCE(external_item_id, imdb_id, '')), 3) GLOB '[0-9]*'
    AND substr(lower(COALESCE(external_item_id, imdb_id, '')), 3) NOT GLOB '*[^0-9]*'
    THEN 'imdb:' || lower(COALESCE(external_item_id, imdb_id))
  ELSE external_provider || ':' || COALESCE(external_item_id, imdb_id)
END
WHERE COALESCE(external_item_id, imdb_id) IS NOT NULL AND COALESCE(external_item_id, imdb_id) != '';

INSERT OR IGNORE INTO external_item_identities (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
SELECT username_hash, canonical_item_id, external_provider, COALESCE(external_item_id, imdb_id),
  CASE WHEN canonical_item_id = external_provider || ':' || COALESCE(external_item_id, imdb_id) THEN 'provider' ELSE 'fallback' END
FROM collection_items
WHERE canonical_item_id IS NOT NULL AND COALESCE(external_item_id, imdb_id) IS NOT NULL AND COALESCE(external_item_id, imdb_id) != '';

INSERT OR IGNORE INTO external_item_identities (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
SELECT username_hash, canonical_item_id, 'imdb', lower(COALESCE(external_item_id, imdb_id)), 'provider'
FROM collection_items
WHERE canonical_item_id LIKE 'imdb:%' AND COALESCE(external_item_id, imdb_id) IS NOT NULL AND COALESCE(external_item_id, imdb_id) != '';

CREATE INDEX IF NOT EXISTS idx_collection_items_canonical_identity
  ON collection_items(username_hash, canonical_item_id, list_type);
CREATE INDEX IF NOT EXISTS idx_external_item_identities_canonical_item_id
  ON external_item_identities(username_hash, canonical_item_id);
