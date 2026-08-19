CREATE INDEX IF NOT EXISTS idx_access_tokens_username_token ON access_tokens(username_hash, token_hash);
DROP INDEX IF EXISTS idx_access_tokens_username;
