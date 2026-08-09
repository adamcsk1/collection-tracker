-- Rename list_type watchlist → up-next and feature pref key watchlist → upNext.
-- Do not edit prior migrations; this applies on top of 032.

PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;

BEGIN IMMEDIATE;

ALTER TABLE collection_items RENAME TO collection_items_old;

CREATE TABLE collection_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username_hash TEXT NOT NULL,
  external_provider TEXT NOT NULL DEFAULT 'omdb',
  external_item_id TEXT,
  canonical_item_id TEXT,
  list_type TEXT NOT NULL DEFAULT 'library' CHECK (list_type IN ('library', 'up-next', 'wishlist', 'tracking', 'books')),
  title TEXT NOT NULL,
  title_lower TEXT NOT NULL,
  year TEXT NOT NULL,
  user_rate REAL CHECK (user_rate IS NULL OR (user_rate >= 0 AND user_rate <= 10 AND ROUND(user_rate * 10) = user_rate * 10)),
  contributors TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  content_type TEXT NOT NULL DEFAULT 'movie' CHECK (content_type IN ('movie', 'series', 'book')),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  CHECK (list_type != 'books' OR content_type = 'book'),
  CHECK (list_type != 'library' OR content_type IN ('movie', 'series')),
  CHECK (list_type != 'tracking' OR content_type IN ('movie', 'series', 'book')),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

INSERT INTO collection_items (
  id, username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year,
  user_rate, contributors, description, image, content_hash, created_at, updated_at, content_type, favorite
)
SELECT
  id, username_hash, external_provider, external_item_id, canonical_item_id,
  CASE list_type WHEN 'watchlist' THEN 'up-next' ELSE list_type END,
  title, title_lower, year,
  user_rate, contributors, description, image, content_hash, created_at, updated_at, content_type, favorite
FROM collection_items_old;

ALTER TABLE collection_item_external_ratings RENAME TO collection_item_external_ratings_old;
CREATE TABLE collection_item_external_ratings (
  item_id INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('imdb', 'rotten-tomatoes', 'metacritic')),
  value TEXT NOT NULL CHECK (length(trim(value)) > 0),
  PRIMARY KEY (item_id, source),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);
INSERT INTO collection_item_external_ratings (item_id, source, value)
SELECT item_id, source, value FROM collection_item_external_ratings_old
WHERE item_id IN (SELECT id FROM collection_items);
DROP TABLE collection_item_external_ratings_old;

ALTER TABLE collection_item_tracker_state RENAME TO collection_item_tracker_state_old;
CREATE TABLE collection_item_tracker_state (
  item_id INTEGER PRIMARY KEY,
  completed_at TEXT,
  progress_current INTEGER CHECK (progress_current IS NULL OR progress_current >= 0),
  progress_total INTEGER CHECK (progress_total IS NULL OR progress_total >= 1),
  CHECK (
    progress_current IS NULL
    OR progress_total IS NULL
    OR progress_current <= progress_total
  ),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);
INSERT INTO collection_item_tracker_state (item_id, completed_at, progress_current, progress_total)
SELECT item_id, completed_at, progress_current, progress_total FROM collection_item_tracker_state_old
WHERE item_id IN (SELECT id FROM collection_items);
DROP TABLE collection_item_tracker_state_old;

ALTER TABLE collection_item_genres RENAME TO collection_item_genres_old;
CREATE TABLE collection_item_genres (
  item_id INTEGER NOT NULL,
  genre TEXT NOT NULL,
  PRIMARY KEY (item_id, genre),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);
INSERT INTO collection_item_genres (item_id, genre)
SELECT item_id, genre FROM collection_item_genres_old
WHERE item_id IN (SELECT id FROM collection_items);
DROP TABLE collection_item_genres_old;

ALTER TABLE collection_item_tags RENAME TO collection_item_tags_old;
CREATE TABLE collection_item_tags (
  item_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (item_id, tag),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);
INSERT INTO collection_item_tags (item_id, tag)
SELECT item_id, tag FROM collection_item_tags_old
WHERE item_id IN (SELECT id FROM collection_items);
DROP TABLE collection_item_tags_old;

ALTER TABLE series_tracking_seasons RENAME TO series_tracking_seasons_old;
CREATE TABLE series_tracking_seasons (
  item_id INTEGER NOT NULL,
  season INTEGER NOT NULL CHECK (season >= 1 AND season <= 50),
  episodes INTEGER NOT NULL CHECK (episodes >= 1 AND episodes <= 100),
  episode_titles TEXT,
  PRIMARY KEY (item_id, season),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);
INSERT INTO series_tracking_seasons (item_id, season, episodes, episode_titles)
SELECT item_id, season, episodes, episode_titles FROM series_tracking_seasons_old
WHERE item_id IN (SELECT id FROM collection_items);
DROP TABLE series_tracking_seasons_old;

ALTER TABLE series_completed_episodes RENAME TO series_completed_episodes_old;
CREATE TABLE series_completed_episodes (
  item_id INTEGER NOT NULL,
  season INTEGER NOT NULL CHECK (season >= 1 AND season <= 50),
  episode INTEGER NOT NULL CHECK (episode >= 1 AND episode <= 100),
  PRIMARY KEY (item_id, season, episode),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);
INSERT INTO series_completed_episodes (item_id, season, episode)
SELECT item_id, season, episode FROM series_completed_episodes_old
WHERE item_id IN (SELECT id FROM collection_items);
DROP TABLE series_completed_episodes_old;

ALTER TABLE ai_search_embeddings RENAME TO ai_search_embeddings_old;
CREATE TABLE ai_search_embeddings (
  item_id INTEGER NOT NULL,
  embedding_model TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, embedding_model),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);
INSERT INTO ai_search_embeddings (item_id, embedding_model, content_hash, embedding_json, created_at, updated_at)
SELECT item_id, embedding_model, content_hash, embedding_json, created_at, updated_at FROM ai_search_embeddings_old
WHERE item_id IN (SELECT id FROM collection_items);
DROP TABLE ai_search_embeddings_old;

DROP TABLE collection_items_old;

CREATE UNIQUE INDEX idx_collection_items_external_identity
  ON collection_items(username_hash, external_provider, external_item_id, list_type)
  WHERE external_item_id IS NOT NULL;
CREATE UNIQUE INDEX idx_collection_items_unique_canonical_identity
  ON collection_items(username_hash, canonical_item_id, list_type)
  WHERE canonical_item_id IS NOT NULL;
CREATE INDEX idx_collection_items_canonical_identity
  ON collection_items(username_hash, canonical_item_id, list_type);
CREATE INDEX idx_collection_items_username ON collection_items(username_hash);
CREATE INDEX idx_collection_items_created ON collection_items(username_hash, created_at);
CREATE INDEX idx_collection_items_list_type ON collection_items(username_hash, list_type, created_at);
CREATE INDEX idx_collection_items_content_type ON collection_items(username_hash, list_type, content_type);
CREATE INDEX idx_collection_items_favorite ON collection_items(username_hash, list_type, favorite);
CREATE INDEX idx_collection_item_genres_item ON collection_item_genres(item_id);
CREATE INDEX idx_collection_item_tags_item ON collection_item_tags(item_id);
CREATE INDEX idx_series_tracking_seasons_item ON series_tracking_seasons(item_id);
CREATE INDEX idx_series_completed_episodes_item ON series_completed_episodes(item_id);
CREATE INDEX idx_ai_search_embeddings_item ON ai_search_embeddings(item_id);
CREATE INDEX idx_collection_item_tracker_state_completed_at
  ON collection_item_tracker_state(completed_at) WHERE completed_at IS NOT NULL;

UPDATE user_settings
SET collection_feature_preferences = CASE
  WHEN collection_feature_preferences IS NULL THEN NULL
  WHEN json_valid(collection_feature_preferences) THEN
    json_object(
      'books', CASE WHEN COALESCE(json_extract(collection_feature_preferences, '$.books'), 1) = 1 THEN json('true') ELSE json('false') END,
      'wishlist', CASE WHEN COALESCE(json_extract(collection_feature_preferences, '$.wishlist'), 1) = 1 THEN json('true') ELSE json('false') END,
      'upNext', CASE
        WHEN COALESCE(json_extract(collection_feature_preferences, '$.upNext'), NULL) IS NOT NULL
          THEN CASE WHEN json_extract(collection_feature_preferences, '$.upNext') = 1 THEN json('true') ELSE json('false') END
        WHEN COALESCE(json_extract(collection_feature_preferences, '$."up-next"'), NULL) IS NOT NULL
          THEN CASE WHEN json_extract(collection_feature_preferences, '$."up-next"') = 1 THEN json('true') ELSE json('false') END
        WHEN COALESCE(json_extract(collection_feature_preferences, '$.watchlist'), 1) = 1 THEN json('true')
        ELSE json('false')
      END,
      'tracking', CASE WHEN COALESCE(json_extract(collection_feature_preferences, '$.tracking'), 1) = 1 THEN json('true') ELSE json('false') END
    )
  ELSE collection_feature_preferences
END
WHERE collection_feature_preferences IS NOT NULL;

INSERT INTO schema_migrations (id) VALUES ('033_rename_watchlist_to_up_next.sql');

COMMIT;

PRAGMA foreign_keys = ON;
PRAGMA legacy_alter_table = OFF;
