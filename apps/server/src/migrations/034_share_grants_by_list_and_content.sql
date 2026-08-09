-- Split share relationships from list/content-scoped grants.

PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;

BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS user_share_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_username_hash TEXT NOT NULL,
  shared_with_username_hash TEXT NOT NULL,
  list_type TEXT NOT NULL,
  content_type TEXT NOT NULL,
  can_read INTEGER NOT NULL DEFAULT 1,
  can_create INTEGER NOT NULL DEFAULT 0,
  can_update INTEGER NOT NULL DEFAULT 0,
  can_delete INTEGER NOT NULL DEFAULT 0,
  UNIQUE(owner_username_hash, shared_with_username_hash, list_type, content_type),
  FOREIGN KEY (owner_username_hash) REFERENCES users(username_hash) ON DELETE CASCADE,
  FOREIGN KEY (shared_with_username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_share_grants_shared_with
  ON user_share_grants(shared_with_username_hash);
CREATE INDEX IF NOT EXISTS idx_user_share_grants_owner
  ON user_share_grants(owner_username_hash);
CREATE INDEX IF NOT EXISTS idx_user_share_grants_shared_read
  ON user_share_grants(shared_with_username_hash, can_read, list_type);

INSERT INTO user_share_grants (
  owner_username_hash,
  shared_with_username_hash,
  list_type,
  content_type,
  can_read,
  can_create,
  can_update,
  can_delete
)
SELECT
  owner_username_hash,
  shared_with_username_hash,
  'library',
  'movie',
  CASE WHEN can_read = 1 OR can_create = 1 OR can_update = 1 OR can_delete = 1 THEN 1 ELSE 0 END,
  can_create,
  can_update,
  can_delete
FROM user_shares
WHERE can_read = 1 OR can_create = 1 OR can_update = 1 OR can_delete = 1;

INSERT INTO user_share_grants (
  owner_username_hash,
  shared_with_username_hash,
  list_type,
  content_type,
  can_read,
  can_create,
  can_update,
  can_delete
)
SELECT
  owner_username_hash,
  shared_with_username_hash,
  'library',
  'series',
  CASE WHEN can_read = 1 OR can_create = 1 OR can_update = 1 OR can_delete = 1 THEN 1 ELSE 0 END,
  can_create,
  can_update,
  can_delete
FROM user_shares
WHERE can_read = 1 OR can_create = 1 OR can_update = 1 OR can_delete = 1;

CREATE TABLE user_shares_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_username_hash TEXT NOT NULL,
  shared_with_username_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_username_hash, shared_with_username_hash),
  FOREIGN KEY (owner_username_hash) REFERENCES users(username_hash) ON DELETE CASCADE,
  FOREIGN KEY (shared_with_username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

INSERT INTO user_shares_new (id, owner_username_hash, shared_with_username_hash, created_at)
SELECT id, owner_username_hash, shared_with_username_hash, created_at
FROM user_shares
WHERE EXISTS (
  SELECT 1
  FROM user_share_grants
  WHERE user_share_grants.owner_username_hash = user_shares.owner_username_hash
    AND user_share_grants.shared_with_username_hash = user_shares.shared_with_username_hash
);

DROP TABLE user_shares;
ALTER TABLE user_shares_new RENAME TO user_shares;

CREATE INDEX IF NOT EXISTS idx_user_shares_owner ON user_shares(owner_username_hash);
CREATE INDEX IF NOT EXISTS idx_user_shares_shared_with ON user_shares(shared_with_username_hash);

INSERT INTO schema_migrations (id) VALUES ('034_share_grants_by_list_and_content.sql');

COMMIT;

PRAGMA foreign_keys = ON;
PRAGMA legacy_alter_table = OFF;
