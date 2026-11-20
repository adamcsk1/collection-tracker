CREATE TABLE user_profiles (
  username_hash TEXT PRIMARY KEY REFERENCES users(username_hash) ON DELETE CASCADE,
  display_name TEXT,
  avatar BLOB,
  avatar_revision TEXT,
  CHECK ((avatar IS NULL) = (avatar_revision IS NULL))
);
