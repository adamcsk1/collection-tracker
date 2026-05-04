import Database from 'better-sqlite3';
import {
  AccessTokenModel,
  RefreshTokenModel,
  SignUpApiResponseModel,
  UserSettingsApiResponseModel,
  UserSettingsApiRequestModel,
} from '@shared/models/api-model';

export interface UserRow {
  username_hash: string;
  user_token_hash: string;
}

export const insertUser = (db: Database.Database, usernameHash: string, userTokenHash: string): void => {
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, userTokenHash);
};

export const upsertUser = (db: Database.Database, usernameHash: string, userTokenHash: string): void => {
  db.prepare(
    `INSERT INTO users (username_hash, user_token_hash)
     VALUES (?, ?)
     ON CONFLICT(username_hash) DO UPDATE SET user_token_hash = excluded.user_token_hash`
  ).run(usernameHash, userTokenHash);
};

export const countUsers = (db: Database.Database): number => {
  return (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
};

export const findUserByHash = (db: Database.Database, usernameHash: string): UserRow | undefined => {
  return db.prepare('SELECT * FROM users WHERE username_hash = ?').get(usernameHash) as UserRow | undefined;
};

export const deleteUser = (db: Database.Database, usernameHash: string): void => {
  db.prepare('DELETE FROM users WHERE username_hash = ?').run(usernameHash);
};

export const insertAccessToken = (db: Database.Database, usernameHash: string, token: AccessTokenModel): void => {
  db.prepare(
    `INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(usernameHash, token.tokenHash, token.createdAt, token.userAgent, token.expiresAt);
};

export const findAccessTokensByUser = (db: Database.Database, usernameHash: string): AccessTokenModel[] => {
  const rows = db.prepare('SELECT * FROM access_tokens WHERE username_hash = ?').all(usernameHash) as Array<{
    token_hash: string;
    created_at: string;
    user_agent: string;
    expires_at: string | null;
  }>;

  return rows.map((row) => ({
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    userAgent: row.user_agent,
    expiresAt: row.expires_at,
  }));
};

export const deleteAccessToken = (db: Database.Database, usernameHash: string, tokenHash: string): void => {
  db.prepare('DELETE FROM access_tokens WHERE username_hash = ? AND token_hash = ?').run(usernameHash, tokenHash);
};

export const deleteExpiredAccessTokens = (db: Database.Database, usernameHash: string, now: string): void => {
  db.prepare('DELETE FROM access_tokens WHERE username_hash = ? AND expires_at IS NOT NULL AND expires_at <= ?').run(
    usernameHash,
    now
  );
};

export const insertRefreshToken = (db: Database.Database, usernameHash: string, token: RefreshTokenModel): void => {
  db.prepare(
    `INSERT INTO refresh_tokens (username_hash, token_hash, created_at, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(usernameHash, token.tokenHash, token.createdAt, token.userAgent, token.expiresAt);
};

export const findRefreshTokensByUser = (db: Database.Database, usernameHash: string): RefreshTokenModel[] => {
  const rows = db.prepare('SELECT * FROM refresh_tokens WHERE username_hash = ?').all(usernameHash) as Array<{
    token_hash: string;
    created_at: string;
    user_agent: string;
    expires_at: string | null;
  }>;

  return rows.map((row) => ({
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    userAgent: row.user_agent,
    expiresAt: row.expires_at,
  }));
};

export const deleteRefreshToken = (db: Database.Database, usernameHash: string, tokenHash: string): void => {
  db.prepare('DELETE FROM refresh_tokens WHERE username_hash = ? AND token_hash = ?').run(usernameHash, tokenHash);
};

export const deleteExpiredRefreshTokens = (db: Database.Database, usernameHash: string, now: string): void => {
  db.prepare('DELETE FROM refresh_tokens WHERE username_hash = ? AND expires_at IS NOT NULL AND expires_at <= ?').run(
    usernameHash,
    now
  );
};

export const deleteTokensByUser = (db: Database.Database, usernameHash: string): void => {
  db.prepare('DELETE FROM access_tokens WHERE username_hash = ?').run(usernameHash);
  db.prepare('DELETE FROM refresh_tokens WHERE username_hash = ?').run(usernameHash);
};

export const findUserSettings = (
  db: Database.Database,
  usernameHash: string
): UserSettingsApiResponseModel | undefined => {
  const row = db.prepare('SELECT * FROM user_settings WHERE username_hash = ?').get(usernameHash) as
    | {
        theme: string | null;
        animated_background: number | null;
        language: string | null;
        claude_ai_available: number | null;
      }
    | undefined;

  if (!row) return undefined;

  return {
    theme: (row.theme as UserSettingsApiResponseModel['theme']) ?? undefined,
    animatedBackground: row.animated_background === 1 ? true : row.animated_background === 0 ? false : undefined,
    language: (row.language as UserSettingsApiResponseModel['language']) ?? undefined,
    claudeAiAvailable: row.claude_ai_available === 1 ? true : row.claude_ai_available === 0 ? false : undefined,
  };
};

export const upsertUserSettings = (
  db: Database.Database,
  usernameHash: string,
  settings: UserSettingsApiRequestModel
): void => {
  db.prepare(
    `INSERT INTO user_settings
     (username_hash, theme, animated_background, language, claude_ai_available)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(username_hash) DO UPDATE SET
       theme = excluded.theme,
       animated_background = excluded.animated_background,
       language = excluded.language,
       claude_ai_available = excluded.claude_ai_available`
  ).run(
    usernameHash,
    settings.theme ?? null,
    settings.animatedBackground === undefined ? null : settings.animatedBackground ? 1 : 0,
    settings.language ?? null,
    settings.claudeAiAvailable === undefined ? null : settings.claudeAiAvailable ? 1 : 0
  );
};
