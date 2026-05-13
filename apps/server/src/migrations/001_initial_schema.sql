CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  username_hash TEXT PRIMARY KEY,
  user_token_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  expires_at TEXT,
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_access_tokens_username ON access_tokens(username_hash);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  expires_at TEXT,
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_username ON refresh_tokens(username_hash);

CREATE TABLE IF NOT EXISTS collection_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username_hash TEXT NOT NULL,
  imdb_id TEXT NOT NULL,
  title TEXT NOT NULL,
  title_lower TEXT NOT NULL,
  year TEXT NOT NULL,
  rate TEXT NOT NULL,
  plot TEXT NOT NULL,
  actors TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(username_hash, imdb_id),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collection_items_username ON collection_items(username_hash);
CREATE INDEX IF NOT EXISTS idx_collection_items_created ON collection_items(username_hash, created_at);

CREATE TABLE IF NOT EXISTS collection_item_genres (
  item_id INTEGER NOT NULL,
  genre TEXT NOT NULL,
  PRIMARY KEY (item_id, genre),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collection_item_genres_item ON collection_item_genres(item_id);

CREATE TABLE IF NOT EXISTS collection_item_tags (
  item_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (item_id, tag),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collection_item_tags_item ON collection_item_tags(item_id);

CREATE TABLE IF NOT EXISTS user_settings (
  username_hash TEXT PRIMARY KEY,
  theme TEXT,
  animated_background INTEGER,
  language TEXT,
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tag_configs (
  username_hash TEXT NOT NULL,
  tag TEXT NOT NULL,
  color TEXT,
  use_for_image_border INTEGER NOT NULL,
  use_for_text_color INTEGER NOT NULL,
  use_for_image_badge INTEGER NOT NULL,
  weight INTEGER NOT NULL,
  PRIMARY KEY (username_hash, tag),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tag_configs_username ON tag_configs(username_hash);
