PRAGMA legacy_alter_table = ON;

ALTER TABLE collection_items RENAME TO collection_items_old;

CREATE TABLE collection_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username_hash TEXT NOT NULL,
  external_provider TEXT NOT NULL DEFAULT 'omdb',
  external_item_id TEXT,
  canonical_item_id TEXT,
  list_type TEXT NOT NULL DEFAULT 'library' CHECK (list_type IN ('library', 'up-next', 'wishlist', 'tracking', 'books', 'music')),
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
  content_type TEXT NOT NULL DEFAULT 'movie' CHECK (content_type IN ('movie', 'series', 'book', 'album')),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  CHECK (list_type != 'books' OR content_type = 'book'),
  CHECK (list_type != 'music' OR content_type = 'album'),
  CHECK (list_type != 'library' OR content_type IN ('movie', 'series')),
  CHECK (list_type != 'tracking' OR content_type IN ('movie', 'series', 'book', 'album')),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

INSERT INTO collection_items (
  id, username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year,
  user_rate, contributors, description, image, content_hash, created_at, updated_at, content_type, favorite
)
SELECT
  id, username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year,
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
SELECT item_id, source, value FROM collection_item_external_ratings_old;
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
SELECT item_id, completed_at, progress_current, progress_total FROM collection_item_tracker_state_old;
DROP TABLE collection_item_tracker_state_old;

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
SELECT item_id, season, episodes, episode_titles FROM series_tracking_seasons_old;
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
SELECT item_id, season, episode FROM series_completed_episodes_old;
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
SELECT item_id, embedding_model, content_hash, embedding_json, created_at, updated_at FROM ai_search_embeddings_old;
DROP TABLE ai_search_embeddings_old;

DROP TRIGGER enforce_selected_grant_before_item_selection_insert;
DROP TRIGGER enforce_selected_grant_before_item_selection_update;
DROP TRIGGER cleanup_item_selections_after_grant_delete;
DROP TRIGGER prune_empty_selected_grant_after_item_selection_delete;
DROP TRIGGER prune_empty_old_selected_grant_after_item_selection_update;

CREATE UNIQUE INDEX idx_collection_items_id_owner_music_migration
  ON collection_items(id, username_hash);

ALTER TABLE user_share_item_selections RENAME TO user_share_item_selections_old;
CREATE TABLE user_share_item_selections (
  owner_username_hash TEXT NOT NULL,
  shared_with_username_hash TEXT NOT NULL,
  collection_item_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_username_hash, shared_with_username_hash, collection_item_id),
  FOREIGN KEY (owner_username_hash, shared_with_username_hash)
    REFERENCES user_shares(owner_username_hash, shared_with_username_hash) ON DELETE CASCADE,
  FOREIGN KEY (collection_item_id, owner_username_hash)
    REFERENCES collection_items(id, username_hash) ON DELETE CASCADE
);
INSERT INTO user_share_item_selections
  (owner_username_hash, shared_with_username_hash, collection_item_id, created_at)
SELECT owner_username_hash, shared_with_username_hash, collection_item_id, created_at
FROM user_share_item_selections_old;
DROP TABLE user_share_item_selections_old;

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
CREATE INDEX idx_collection_items_list_title_id
  ON collection_items(username_hash, list_type, title_lower, id);
CREATE UNIQUE INDEX idx_collection_items_id_owner
  ON collection_items(id, username_hash);
DROP INDEX idx_collection_items_id_owner_music_migration;
CREATE INDEX idx_collection_item_genres_item ON collection_item_genres(item_id);
CREATE INDEX idx_collection_item_tags_item ON collection_item_tags(item_id);
CREATE INDEX idx_series_tracking_seasons_item ON series_tracking_seasons(item_id);
CREATE INDEX idx_series_completed_episodes_item ON series_completed_episodes(item_id);
CREATE INDEX idx_ai_search_embeddings_item ON ai_search_embeddings(item_id);
CREATE INDEX idx_collection_item_tracker_state_completed_at
  ON collection_item_tracker_state(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_user_share_item_selections_recipient
  ON user_share_item_selections(shared_with_username_hash, collection_item_id);
CREATE INDEX idx_user_share_item_selections_item
  ON user_share_item_selections(collection_item_id);

CREATE TRIGGER enforce_selected_grant_before_item_selection_insert
BEFORE INSERT ON user_share_item_selections
WHEN NOT EXISTS (
  SELECT 1
  FROM collection_items item
  INNER JOIN user_share_grants grant_scope
    ON grant_scope.owner_username_hash = NEW.owner_username_hash
   AND grant_scope.shared_with_username_hash = NEW.shared_with_username_hash
   AND grant_scope.list_type = item.list_type
   AND grant_scope.content_type = item.content_type
   AND grant_scope.scope_mode = 'selected'
  WHERE item.id = NEW.collection_item_id
    AND item.username_hash = NEW.owner_username_hash
)
BEGIN
  SELECT RAISE(ABORT, 'item selection requires an exact selected grant');
END;

CREATE TRIGGER enforce_selected_grant_before_item_selection_update
BEFORE UPDATE OF owner_username_hash, shared_with_username_hash, collection_item_id ON user_share_item_selections
WHEN NOT EXISTS (
  SELECT 1
  FROM collection_items item
  INNER JOIN user_share_grants grant_scope
    ON grant_scope.owner_username_hash = NEW.owner_username_hash
   AND grant_scope.shared_with_username_hash = NEW.shared_with_username_hash
   AND grant_scope.list_type = item.list_type
   AND grant_scope.content_type = item.content_type
   AND grant_scope.scope_mode = 'selected'
  WHERE item.id = NEW.collection_item_id
    AND item.username_hash = NEW.owner_username_hash
)
BEGIN
  SELECT RAISE(ABORT, 'item selection requires an exact selected grant');
END;

CREATE TRIGGER cleanup_item_selections_after_grant_delete
AFTER DELETE ON user_share_grants
BEGIN
  DELETE FROM user_share_item_selections
  WHERE owner_username_hash = OLD.owner_username_hash
    AND shared_with_username_hash = OLD.shared_with_username_hash
    AND collection_item_id IN (
      SELECT id
      FROM collection_items
      WHERE username_hash = OLD.owner_username_hash
        AND list_type = OLD.list_type
        AND content_type = OLD.content_type
    );
END;

CREATE TRIGGER prune_empty_selected_grant_after_item_selection_delete
AFTER DELETE ON user_share_item_selections
BEGIN
  DELETE FROM user_share_grants
  WHERE owner_username_hash = OLD.owner_username_hash
    AND shared_with_username_hash = OLD.shared_with_username_hash
    AND scope_mode = 'selected'
    AND EXISTS (
      SELECT 1
      FROM collection_items removed_item
      WHERE removed_item.id = OLD.collection_item_id
        AND removed_item.username_hash = OLD.owner_username_hash
        AND removed_item.list_type = user_share_grants.list_type
        AND removed_item.content_type = user_share_grants.content_type
    )
    AND NOT EXISTS (
      SELECT 1
      FROM user_share_item_selections remaining
      INNER JOIN collection_items remaining_item ON remaining_item.id = remaining.collection_item_id
      WHERE remaining.owner_username_hash = user_share_grants.owner_username_hash
        AND remaining.shared_with_username_hash = user_share_grants.shared_with_username_hash
        AND remaining_item.list_type = user_share_grants.list_type
        AND remaining_item.content_type = user_share_grants.content_type
    );
END;

CREATE TRIGGER prune_empty_old_selected_grant_after_item_selection_update
AFTER UPDATE OF owner_username_hash, shared_with_username_hash, collection_item_id ON user_share_item_selections
WHEN OLD.owner_username_hash != NEW.owner_username_hash
  OR OLD.shared_with_username_hash != NEW.shared_with_username_hash
  OR OLD.collection_item_id != NEW.collection_item_id
BEGIN
  DELETE FROM user_share_grants
  WHERE owner_username_hash = OLD.owner_username_hash
    AND shared_with_username_hash = OLD.shared_with_username_hash
    AND scope_mode = 'selected'
    AND EXISTS (
      SELECT 1
      FROM collection_items old_item
      WHERE old_item.id = OLD.collection_item_id
        AND old_item.username_hash = OLD.owner_username_hash
        AND old_item.list_type = user_share_grants.list_type
        AND old_item.content_type = user_share_grants.content_type
    )
    AND NOT EXISTS (
      SELECT 1
      FROM user_share_item_selections remaining
      INNER JOIN collection_items remaining_item ON remaining_item.id = remaining.collection_item_id
      WHERE remaining.owner_username_hash = user_share_grants.owner_username_hash
        AND remaining.shared_with_username_hash = user_share_grants.shared_with_username_hash
        AND remaining_item.list_type = user_share_grants.list_type
        AND remaining_item.content_type = user_share_grants.content_type
    );
END;

CREATE TRIGGER cleanup_item_shares_before_collection_item_delete
BEFORE DELETE ON collection_items
BEGIN
  DELETE FROM user_share_item_selections WHERE collection_item_id = OLD.id;
  DELETE FROM user_share_grants
  WHERE owner_username_hash = OLD.username_hash
    AND list_type = OLD.list_type
    AND content_type = OLD.content_type
    AND scope_mode = 'selected'
    AND NOT EXISTS (
      SELECT 1
      FROM user_share_item_selections remaining
      INNER JOIN collection_items remaining_item ON remaining_item.id = remaining.collection_item_id
      WHERE remaining.owner_username_hash = user_share_grants.owner_username_hash
        AND remaining.shared_with_username_hash = user_share_grants.shared_with_username_hash
        AND remaining_item.list_type = user_share_grants.list_type
        AND remaining_item.content_type = user_share_grants.content_type
    );
END;

CREATE TRIGGER cleanup_item_shares_before_collection_item_scope_change
BEFORE UPDATE OF list_type, content_type ON collection_items
WHEN OLD.list_type != NEW.list_type OR OLD.content_type != NEW.content_type
BEGIN
  DELETE FROM user_share_item_selections WHERE collection_item_id = OLD.id;
  DELETE FROM user_share_grants
  WHERE owner_username_hash = OLD.username_hash
    AND list_type = OLD.list_type
    AND content_type = OLD.content_type
    AND scope_mode = 'selected'
    AND NOT EXISTS (
      SELECT 1
      FROM user_share_item_selections remaining
      INNER JOIN collection_items remaining_item ON remaining_item.id = remaining.collection_item_id
      WHERE remaining.owner_username_hash = user_share_grants.owner_username_hash
        AND remaining.shared_with_username_hash = user_share_grants.shared_with_username_hash
        AND remaining_item.list_type = user_share_grants.list_type
        AND remaining_item.content_type = user_share_grants.content_type
    );
END;

ALTER TABLE collection_owner_defaults RENAME TO collection_owner_defaults_old;

CREATE TABLE collection_owner_defaults (
  username_hash TEXT NOT NULL,
  list_type TEXT NOT NULL,
  content_type TEXT NOT NULL,
  owner_username_hash TEXT NOT NULL,
  CHECK (username_hash <> owner_username_hash),
  CHECK (
    (list_type = 'library' AND content_type IN ('movie', 'series')) OR
    (list_type = 'books' AND content_type = 'book') OR
    (list_type = 'music' AND content_type = 'album') OR
    (list_type IN ('wishlist', 'up-next', 'tracking') AND content_type IN ('movie', 'series', 'book', 'album'))
  ),
  PRIMARY KEY (username_hash, list_type, content_type),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE,
  FOREIGN KEY (owner_username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

INSERT INTO collection_owner_defaults (username_hash, list_type, content_type, owner_username_hash)
SELECT username_hash, list_type, content_type, owner_username_hash
FROM collection_owner_defaults_old;

DROP TABLE collection_owner_defaults_old;

CREATE INDEX collection_owner_defaults_owner_idx ON collection_owner_defaults(owner_username_hash);

UPDATE user_settings
SET collection_feature_preferences = CASE
  WHEN collection_feature_preferences IS NULL THEN NULL
  WHEN json_valid(collection_feature_preferences) THEN
    json_set(collection_feature_preferences, '$.music', json('true'))
  ELSE collection_feature_preferences
END
WHERE collection_feature_preferences IS NOT NULL;

PRAGMA legacy_alter_table = OFF;
