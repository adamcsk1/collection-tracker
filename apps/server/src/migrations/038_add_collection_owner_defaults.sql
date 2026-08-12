CREATE TABLE collection_owner_defaults (
  username_hash TEXT NOT NULL,
  list_type TEXT NOT NULL,
  content_type TEXT NOT NULL,
  owner_username_hash TEXT NOT NULL,
  CHECK (username_hash <> owner_username_hash),
  CHECK (
    (list_type = 'library' AND content_type IN ('movie', 'series')) OR
    (list_type = 'books' AND content_type = 'book') OR
    (list_type IN ('wishlist', 'up-next', 'tracking') AND content_type IN ('movie', 'series', 'book'))
  ),
  PRIMARY KEY (username_hash, list_type, content_type),
  FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE,
  FOREIGN KEY (owner_username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

CREATE INDEX collection_owner_defaults_owner_idx ON collection_owner_defaults(owner_username_hash);
