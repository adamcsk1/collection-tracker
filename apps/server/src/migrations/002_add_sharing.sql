CREATE TABLE IF NOT EXISTS user_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_username_hash TEXT NOT NULL,
  shared_with_username_hash TEXT NOT NULL,
  can_read INTEGER NOT NULL DEFAULT 1,
  can_create INTEGER NOT NULL DEFAULT 0,
  can_update INTEGER NOT NULL DEFAULT 0,
  can_delete INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_username_hash, shared_with_username_hash),
  FOREIGN KEY (owner_username_hash) REFERENCES users(username_hash) ON DELETE CASCADE,
  FOREIGN KEY (shared_with_username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_shares_owner ON user_shares(owner_username_hash);
CREATE INDEX IF NOT EXISTS idx_user_shares_shared_with ON user_shares(shared_with_username_hash);
