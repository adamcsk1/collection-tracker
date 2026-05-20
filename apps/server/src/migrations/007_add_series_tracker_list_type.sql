PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;

ALTER TABLE collection_items RENAME TO collection_items_old;
ALTER TABLE collection_item_genres RENAME TO collection_item_genres_old;
ALTER TABLE collection_item_tags RENAME TO collection_item_tags_old;

CREATE TABLE collection_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username_hash TEXT NOT NULL,
  imdb_id TEXT NOT NULL,
  list_type TEXT NOT NULL DEFAULT 'library' CHECK (list_type IN ('library', 'watch-later', 'wishlist', 'series-tracker')),
  title TEXT NOT NULL,
  title_lower TEXT NOT NULL,
  year TEXT NOT NULL,
  rate TEXT NOT NULL,
  user_rate REAL,
  actors TEXT NOT NULL DEFAULT '',
  plot TEXT NOT NULL,
  image TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(username_hash, imdb_id, list_type),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

INSERT INTO collection_items (
  id,
  username_hash,
  imdb_id,
  list_type,
  title,
  title_lower,
  year,
  rate,
  user_rate,
  actors,
  plot,
  image,
  content_hash,
  created_at,
  updated_at
)
SELECT
  id,
  username_hash,
  imdb_id,
  list_type,
  title,
  title_lower,
  year,
  rate,
  user_rate,
  actors,
  plot,
  image,
  content_hash,
  created_at,
  updated_at
FROM collection_items_old;

DROP TABLE collection_items_old;

CREATE TABLE collection_item_genres (
  item_id INTEGER NOT NULL,
  genre TEXT NOT NULL,
  PRIMARY KEY (item_id, genre),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

INSERT INTO collection_item_genres (item_id, genre)
SELECT item_id, genre FROM collection_item_genres_old;

DROP TABLE collection_item_genres_old;

CREATE TABLE collection_item_tags (
  item_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (item_id, tag),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

INSERT INTO collection_item_tags (item_id, tag)
SELECT item_id, tag FROM collection_item_tags_old;

DROP TABLE collection_item_tags_old;

CREATE INDEX IF NOT EXISTS idx_collection_items_username ON collection_items(username_hash);
CREATE INDEX IF NOT EXISTS idx_collection_items_created ON collection_items(username_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_collection_items_list_type ON collection_items(username_hash, list_type, created_at);
CREATE INDEX IF NOT EXISTS idx_collection_item_genres_item ON collection_item_genres(item_id);
CREATE INDEX IF NOT EXISTS idx_collection_item_tags_item ON collection_item_tags(item_id);

PRAGMA foreign_keys = ON;
PRAGMA legacy_alter_table = OFF;
