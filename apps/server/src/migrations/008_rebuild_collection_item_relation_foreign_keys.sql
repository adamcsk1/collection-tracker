PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;

ALTER TABLE collection_item_genres RENAME TO collection_item_genres_old;
ALTER TABLE collection_item_tags RENAME TO collection_item_tags_old;

CREATE TABLE collection_item_genres (
  item_id INTEGER NOT NULL,
  genre TEXT NOT NULL,
  PRIMARY KEY (item_id, genre),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

INSERT INTO collection_item_genres (item_id, genre)
SELECT item_id, genre
FROM collection_item_genres_old
WHERE EXISTS (SELECT 1 FROM collection_items WHERE collection_items.id = collection_item_genres_old.item_id);

DROP TABLE collection_item_genres_old;

CREATE TABLE collection_item_tags (
  item_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (item_id, tag),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

INSERT INTO collection_item_tags (item_id, tag)
SELECT item_id, tag
FROM collection_item_tags_old
WHERE EXISTS (SELECT 1 FROM collection_items WHERE collection_items.id = collection_item_tags_old.item_id);

DROP TABLE collection_item_tags_old;

CREATE INDEX IF NOT EXISTS idx_collection_item_genres_item ON collection_item_genres(item_id);
CREATE INDEX IF NOT EXISTS idx_collection_item_tags_item ON collection_item_tags(item_id);

PRAGMA foreign_keys = ON;
PRAGMA legacy_alter_table = OFF;
