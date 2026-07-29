PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;

ALTER TABLE collection_items RENAME TO collection_items_old;

CREATE TABLE collection_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username_hash TEXT NOT NULL,
  imdb_id TEXT,
  external_provider TEXT NOT NULL DEFAULT 'omdb',
  external_item_id TEXT,
  canonical_item_id TEXT,
  list_type TEXT NOT NULL DEFAULT 'library' CHECK (list_type IN ('library', 'watch-later', 'wishlist', 'series-tracker', 'movie-tracker')),
  title TEXT NOT NULL,
  title_lower TEXT NOT NULL,
  year TEXT NOT NULL,
  rate TEXT NOT NULL,
  user_rate REAL CHECK (user_rate IS NULL OR (user_rate >= 0 AND user_rate <= 10 AND ROUND(user_rate * 10) = user_rate * 10)),
  actors TEXT NOT NULL DEFAULT '',
  plot TEXT NOT NULL,
  image TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rotten_tomatoes_rate TEXT NOT NULL DEFAULT '',
  metacritic_rate TEXT NOT NULL DEFAULT '',
  watched_at TEXT,
  content_type TEXT NOT NULL DEFAULT 'movie' CHECK (content_type IN ('movie', 'series')),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

INSERT INTO collection_items (
  id, username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, rate,
  user_rate, actors, plot, image, content_hash, created_at, updated_at, rotten_tomatoes_rate, metacritic_rate,
  watched_at, content_type, favorite
)
SELECT
  id, username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, rate,
  user_rate, actors, plot, image, content_hash, created_at, updated_at, rotten_tomatoes_rate, metacritic_rate,
  watched_at, content_type, favorite
FROM collection_items_old;

DROP TABLE collection_items_old;

ALTER TABLE collection_item_genres RENAME TO collection_item_genres_old;

CREATE TABLE collection_item_genres (
  item_id INTEGER NOT NULL,
  genre TEXT NOT NULL,
  PRIMARY KEY (item_id, genre),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO collection_item_genres (item_id, genre)
SELECT item_id, genre
FROM collection_item_genres_old;

DROP TABLE collection_item_genres_old;

ALTER TABLE collection_item_tags RENAME TO collection_item_tags_old;

CREATE TABLE collection_item_tags (
  item_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (item_id, tag),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO collection_item_tags (item_id, tag)
SELECT item_id, tag
FROM collection_item_tags_old;

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

INSERT OR IGNORE INTO series_tracker_seasons (item_id, season, episodes, episode_titles)
SELECT item_id, season, episodes, episode_titles
FROM series_tracker_seasons_old;

DROP TABLE series_tracker_seasons_old;

ALTER TABLE series_tracker_watched_episodes RENAME TO series_tracker_watched_episodes_old;

CREATE TABLE series_tracker_watched_episodes (
  item_id INTEGER NOT NULL,
  season INTEGER NOT NULL CHECK (season >= 1 AND season <= 50),
  episode INTEGER NOT NULL CHECK (episode >= 1 AND episode <= 100),
  PRIMARY KEY (item_id, season, episode),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO series_tracker_watched_episodes (item_id, season, episode)
SELECT item_id, season, episode
FROM series_tracker_watched_episodes_old;

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

INSERT OR IGNORE INTO ai_search_embeddings (item_id, embedding_model, content_hash, embedding_json, created_at, updated_at)
SELECT item_id, embedding_model, content_hash, embedding_json, created_at, updated_at
FROM ai_search_embeddings_old;

DROP TABLE ai_search_embeddings_old;

ALTER TABLE external_item_identities RENAME TO external_item_identities_old;

CREATE TABLE external_item_identities (
  username_hash TEXT NOT NULL,
  canonical_item_id TEXT NOT NULL,
  external_provider TEXT NOT NULL,
  external_item_id TEXT NOT NULL,
  source_confidence TEXT NOT NULL DEFAULT 'alias' CHECK (source_confidence IN ('primary', 'alias')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username_hash, external_provider, external_item_id),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

INSERT INTO external_item_identities (
  username_hash, canonical_item_id, external_provider, external_item_id, source_confidence, created_at
)
SELECT
  username_hash,
  canonical_item_id,
  external_provider,
  external_item_id,
  CASE
    WHEN source_confidence IN ('fallback', 'primary') THEN 'primary'
    WHEN external_provider = 'imdb' THEN 'alias'
    WHEN canonical_item_id = external_provider || ':' || external_item_id THEN 'primary'
    WHEN source_confidence IN ('provider', 'alias') THEN 'alias'
    ELSE 'alias'
  END,
  created_at
FROM external_item_identities_old;

DROP TABLE external_item_identities_old;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_external_identity
  ON collection_items(username_hash, external_provider, COALESCE(external_item_id, imdb_id), list_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_unique_canonical_identity
  ON collection_items(username_hash, canonical_item_id, list_type)
  WHERE canonical_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collection_items_canonical_identity
  ON collection_items(username_hash, canonical_item_id, list_type);
CREATE INDEX IF NOT EXISTS idx_collection_items_username ON collection_items(username_hash);
CREATE INDEX IF NOT EXISTS idx_collection_items_created ON collection_items(username_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_collection_items_list_type ON collection_items(username_hash, list_type, created_at);
CREATE INDEX IF NOT EXISTS idx_collection_items_watched_at ON collection_items(username_hash, list_type, watched_at);
CREATE INDEX IF NOT EXISTS idx_collection_items_content_type ON collection_items(username_hash, list_type, content_type);
CREATE INDEX IF NOT EXISTS idx_collection_items_favorite ON collection_items(username_hash, list_type, favorite);
CREATE INDEX IF NOT EXISTS idx_collection_item_genres_item ON collection_item_genres(item_id);
CREATE INDEX IF NOT EXISTS idx_collection_item_tags_item ON collection_item_tags(item_id);
CREATE INDEX IF NOT EXISTS idx_series_tracker_seasons_item ON series_tracker_seasons(item_id);
CREATE INDEX IF NOT EXISTS idx_series_tracker_watched_episodes_item ON series_tracker_watched_episodes(item_id);
CREATE INDEX IF NOT EXISTS idx_ai_search_embeddings_item ON ai_search_embeddings(item_id);
CREATE INDEX IF NOT EXISTS idx_external_item_identities_canonical_item_id
  ON external_item_identities(username_hash, canonical_item_id);

CREATE TRIGGER IF NOT EXISTS trg_collection_items_external_item_id_default
AFTER INSERT ON collection_items
FOR EACH ROW
WHEN NEW.external_item_id IS NULL OR NEW.external_item_id = ''
BEGIN
  UPDATE collection_items SET external_item_id = NEW.imdb_id WHERE id = NEW.id;
END;

PRAGMA foreign_keys = ON;
PRAGMA legacy_alter_table = OFF;
