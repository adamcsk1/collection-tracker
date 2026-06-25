PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;

ALTER TABLE collection_items RENAME TO collection_items_old;
ALTER TABLE collection_item_genres RENAME TO collection_item_genres_old;
ALTER TABLE collection_item_tags RENAME TO collection_item_tags_old;

CREATE TABLE collection_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username_hash TEXT NOT NULL,
  imdb_id TEXT NOT NULL,
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
  UNIQUE(username_hash, imdb_id, list_type),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

INSERT INTO collection_items (
  id, username_hash, imdb_id, list_type, title, title_lower, year, rate, user_rate, actors, plot, image,
  content_hash, created_at, updated_at, rotten_tomatoes_rate, metacritic_rate
)
SELECT
  id, username_hash, imdb_id, list_type, title, title_lower, year, rate, user_rate, actors, plot, image,
  content_hash, created_at, updated_at, rotten_tomatoes_rate, metacritic_rate
FROM collection_items_old;

INSERT OR IGNORE INTO collection_items (
  username_hash, imdb_id, list_type, title, title_lower, year, rate, user_rate, actors, plot, image,
  content_hash, created_at, updated_at, rotten_tomatoes_rate, metacritic_rate
)
SELECT
  source.username_hash,
  source.imdb_id,
  'movie-tracker',
  source.title,
  source.title_lower,
  source.year,
  source.rate,
  source.user_rate,
  source.actors,
  source.plot,
  source.image,
  source.content_hash,
  source.created_at,
  source.updated_at,
  source.rotten_tomatoes_rate,
  source.metacritic_rate
FROM collection_items_old source
WHERE source.list_type = 'library'
  AND EXISTS (SELECT 1 FROM collection_item_tags_old watched WHERE watched.item_id = source.id AND watched.tag = '#watched')
  AND EXISTS (SELECT 1 FROM collection_item_tags_old movie WHERE movie.item_id = source.id AND movie.tag = '#movie');

CREATE TABLE collection_item_genres (
  item_id INTEGER NOT NULL,
  genre TEXT NOT NULL,
  PRIMARY KEY (item_id, genre),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO collection_item_genres (item_id, genre)
SELECT new_item.id, old_genre.genre
FROM collection_item_genres_old old_genre
INNER JOIN collection_items_old old_item ON old_item.id = old_genre.item_id
INNER JOIN collection_items new_item ON new_item.username_hash = old_item.username_hash
  AND new_item.imdb_id = old_item.imdb_id
  AND new_item.list_type = old_item.list_type;

INSERT OR IGNORE INTO collection_item_genres (item_id, genre)
SELECT tracker_item.id, old_genre.genre
FROM collection_item_genres_old old_genre
INNER JOIN collection_items_old old_item ON old_item.id = old_genre.item_id
INNER JOIN collection_items tracker_item ON tracker_item.username_hash = old_item.username_hash
  AND tracker_item.imdb_id = old_item.imdb_id
  AND tracker_item.list_type = 'movie-tracker'
WHERE old_item.list_type = 'library'
  AND EXISTS (SELECT 1 FROM collection_item_tags_old watched WHERE watched.item_id = old_item.id AND watched.tag = '#watched')
  AND EXISTS (SELECT 1 FROM collection_item_tags_old movie WHERE movie.item_id = old_item.id AND movie.tag = '#movie');

DROP TABLE collection_item_genres_old;

CREATE TABLE collection_item_tags (
  item_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (item_id, tag),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO collection_item_tags (item_id, tag)
SELECT new_item.id, old_tag.tag
FROM collection_item_tags_old old_tag
INNER JOIN collection_items_old old_item ON old_item.id = old_tag.item_id
INNER JOIN collection_items new_item ON new_item.username_hash = old_item.username_hash
  AND new_item.imdb_id = old_item.imdb_id
  AND new_item.list_type = old_item.list_type
WHERE old_tag.tag != '#watched';

INSERT OR IGNORE INTO collection_item_tags (item_id, tag)
SELECT tracker_item.id, old_tag.tag
FROM collection_item_tags_old old_tag
INNER JOIN collection_items_old old_item ON old_item.id = old_tag.item_id
INNER JOIN collection_items tracker_item ON tracker_item.username_hash = old_item.username_hash
  AND tracker_item.imdb_id = old_item.imdb_id
  AND tracker_item.list_type = 'movie-tracker'
WHERE old_item.list_type = 'library'
  AND old_tag.tag != '#watched'
  AND old_tag.tag NOT IN ('#completed', '#favorite', '#watch-later', '#wishlist', '#series')
  AND EXISTS (SELECT 1 FROM collection_item_tags_old watched WHERE watched.item_id = old_item.id AND watched.tag = '#watched')
  AND EXISTS (SELECT 1 FROM collection_item_tags_old movie WHERE movie.item_id = old_item.id AND movie.tag = '#movie');

DROP TABLE collection_item_tags_old;
DROP TABLE collection_items_old;

CREATE INDEX IF NOT EXISTS idx_collection_items_username ON collection_items(username_hash);
CREATE INDEX IF NOT EXISTS idx_collection_items_created ON collection_items(username_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_collection_items_list_type ON collection_items(username_hash, list_type, created_at);
CREATE INDEX IF NOT EXISTS idx_collection_item_genres_item ON collection_item_genres(item_id);
CREATE INDEX IF NOT EXISTS idx_collection_item_tags_item ON collection_item_tags(item_id);

PRAGMA foreign_keys = ON;
PRAGMA legacy_alter_table = OFF;
