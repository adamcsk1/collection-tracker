PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;

BEGIN IMMEDIATE;

ALTER TABLE collection_items RENAME TO collection_items_old;

UPDATE collection_items_old
SET external_item_id = CASE
      WHEN imdb_id IS NOT NULL
        AND imdb_id != ''
        AND (
          external_item_id IS NULL
          OR external_item_id = ''
          OR LOWER(external_item_id) = LOWER(imdb_id)
        )
      THEN LOWER(imdb_id)
      WHEN external_provider IN ('imdb', 'omdb')
        AND external_item_id IS NOT NULL
        AND LENGTH(external_item_id) >= 3
        AND LOWER(SUBSTR(external_item_id, 1, 2)) = 'tt'
        AND LENGTH(SUBSTR(external_item_id, 3)) > 0
        AND LOWER(SUBSTR(external_item_id, 3)) NOT GLOB '*[^0-9]*'
      THEN LOWER(external_item_id)
      ELSE external_item_id
    END,
    canonical_item_id = COALESCE(
      NULLIF(canonical_item_id, ''),
      (
        SELECT identity.canonical_item_id
        FROM external_item_identities identity
        WHERE identity.username_hash = collection_items_old.username_hash
          AND identity.external_provider = 'imdb'
          AND identity.external_item_id = LOWER(collection_items_old.imdb_id)
        LIMIT 1
      ),
      CASE
        WHEN imdb_id IS NOT NULL AND imdb_id != '' THEN 'imdb:' || LOWER(imdb_id)
      END
    ),
    content_type = CASE
      WHEN list_type = 'movie-tracker' THEN 'movie'
      WHEN list_type = 'series-tracker' THEN 'series'
      ELSE content_type
    END;

INSERT OR IGNORE INTO external_item_identities (
  username_hash, canonical_item_id, external_provider, external_item_id, source_confidence, created_at
)
SELECT username_hash, canonical_item_id, 'imdb', LOWER(imdb_id), 'alias', created_at
FROM collection_items_old
WHERE imdb_id IS NOT NULL
  AND imdb_id != ''
  AND canonical_item_id IS NOT NULL;

CREATE TABLE collection_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username_hash TEXT NOT NULL,
  external_provider TEXT NOT NULL DEFAULT 'omdb',
  external_item_id TEXT,
  canonical_item_id TEXT,
  list_type TEXT NOT NULL DEFAULT 'library' CHECK (list_type IN ('library', 'watch-later', 'wishlist', 'series-tracker', 'movie-tracker', 'book-tracker')),
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
  CHECK ((content_type = 'book') = (list_type = 'book-tracker')),
  CHECK (list_type != 'movie-tracker' OR content_type = 'movie'),
  CHECK (list_type != 'series-tracker' OR content_type = 'series'),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

INSERT INTO collection_items (
  id, username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year,
  user_rate, contributors, description, image, content_hash, created_at, updated_at, content_type, favorite
)
SELECT
  id, username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year,
  user_rate, actors, plot, image, content_hash, created_at, updated_at, content_type, favorite
FROM collection_items_old;

CREATE TABLE collection_item_external_ratings (
  item_id INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('imdb', 'rotten-tomatoes', 'metacritic')),
  value TEXT NOT NULL CHECK (length(trim(value)) > 0),
  PRIMARY KEY (item_id, source),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

INSERT INTO collection_item_external_ratings (item_id, source, value)
SELECT id, 'imdb', rate FROM collection_items_old WHERE length(trim(rate)) > 0
UNION ALL
SELECT id, 'rotten-tomatoes', rotten_tomatoes_rate FROM collection_items_old WHERE length(trim(rotten_tomatoes_rate)) > 0
UNION ALL
SELECT id, 'metacritic', metacritic_rate FROM collection_items_old WHERE length(trim(metacritic_rate)) > 0;

CREATE TABLE collection_item_tracker_state (
  item_id INTEGER PRIMARY KEY,
  completed_at TEXT,
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

INSERT INTO collection_item_tracker_state (item_id, completed_at)
SELECT id, watched_at
FROM collection_items_old
WHERE watched_at IS NOT NULL
   OR list_type IN ('movie-tracker', 'series-tracker');

ALTER TABLE collection_item_genres RENAME TO collection_item_genres_old;
CREATE TABLE collection_item_genres (
  item_id INTEGER NOT NULL,
  genre TEXT NOT NULL,
  PRIMARY KEY (item_id, genre),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);
INSERT INTO collection_item_genres (item_id, genre)
SELECT item_id, genre FROM collection_item_genres_old;
DROP TABLE collection_item_genres_old;

ALTER TABLE collection_item_tags RENAME TO collection_item_tags_old;
CREATE TABLE collection_item_tags (
  item_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (item_id, tag),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);
INSERT INTO collection_item_tags (item_id, tag)
SELECT item_id, tag FROM collection_item_tags_old;
DROP TABLE collection_item_tags_old;

ALTER TABLE series_tracker_seasons RENAME TO series_tracker_seasons_old;
CREATE TABLE series_tracker_seasons (
  item_id INTEGER NOT NULL,
  season INTEGER NOT NULL CHECK (season >= 1 AND season <= 50),
  episodes INTEGER NOT NULL CHECK (episodes >= 1 AND episodes <= 100),
  episode_titles TEXT,
  PRIMARY KEY (item_id, season),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);
INSERT INTO series_tracker_seasons (item_id, season, episodes, episode_titles)
SELECT item_id, season, episodes, episode_titles FROM series_tracker_seasons_old;
DROP TABLE series_tracker_seasons_old;

ALTER TABLE series_tracker_watched_episodes RENAME TO series_tracker_watched_episodes_old;
CREATE TABLE series_tracker_watched_episodes (
  item_id INTEGER NOT NULL,
  season INTEGER NOT NULL CHECK (season >= 1 AND season <= 50),
  episode INTEGER NOT NULL CHECK (episode >= 1 AND episode <= 100),
  PRIMARY KEY (item_id, season, episode),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);
INSERT INTO series_tracker_watched_episodes (item_id, season, episode)
SELECT item_id, season, episode FROM series_tracker_watched_episodes_old;
DROP TABLE series_tracker_watched_episodes_old;

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
SELECT item_id, embedding_model, content_hash, embedding_json, created_at, updated_at FROM ai_search_embeddings_old;
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
CREATE INDEX idx_series_tracker_seasons_item ON series_tracker_seasons(item_id);
CREATE INDEX idx_series_tracker_watched_episodes_item ON series_tracker_watched_episodes(item_id);
CREATE INDEX idx_ai_search_embeddings_item ON ai_search_embeddings(item_id);
CREATE INDEX idx_collection_item_tracker_state_completed_at
  ON collection_item_tracker_state(completed_at) WHERE completed_at IS NOT NULL;

INSERT INTO schema_migrations (id) VALUES ('026_normalize_collection_items.sql');

COMMIT;

PRAGMA foreign_keys = ON;
PRAGMA legacy_alter_table = OFF;
