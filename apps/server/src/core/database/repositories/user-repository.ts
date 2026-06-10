import Database from 'better-sqlite3';
import {
  AccessTokenModel,
  RefreshTokenModel,
  UserSettingsApiResponseModel,
  UserSettingsApiRequestModel,
} from '@shared/models/api-model';
import {
  CollectionListDisplayPreferencesModel,
  COLLECTION_LIST_DISPLAY_RATINGS,
} from '@shared/models/collection-list-display-preferences-model';
import { hashText } from '../../crypto';

export interface UserRow {
  username_hash: string;
  user_token_hash: string;
  username: string | null;
}

export const getUserShareCode = (usernameHash: string): string => hashText(usernameHash).slice(0, 16);

export const insertUser = (
  db: Database.Database,
  usernameHash: string,
  userTokenHash: string,
  username: string
): void => {
  db.prepare('INSERT INTO users (username_hash, user_token_hash, username) VALUES (?, ?, ?)').run(
    usernameHash,
    userTokenHash,
    username
  );
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

export const findUsers = (db: Database.Database): UserRow[] => {
  return db.prepare('SELECT * FROM users').all() as UserRow[];
};

export const findUserByShareCode = (db: Database.Database, userShareCode: string): UserRow | undefined => {
  const matches = findUsers(db).filter((user) => getUserShareCode(user.username_hash) === userShareCode);
  return matches.length === 1 ? matches[0] : undefined;
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
        default_library_owner_share_code: string | null;
        collection_list_display_preferences: string | null;
      }
    | undefined;

  if (!row) return undefined;

  const settings: UserSettingsApiResponseModel = {};
  if (row.theme) settings.theme = row.theme as UserSettingsApiResponseModel['theme'];
  if (row.animated_background !== null) settings.animatedBackground = row.animated_background === 1;
  if (row.language) settings.language = row.language as UserSettingsApiResponseModel['language'];
  if (row.default_library_owner_share_code)
    settings.defaultLibraryOwnerShareCode = row.default_library_owner_share_code;
  const collectionListDisplayPreferences = parseCollectionListDisplayPreferences(
    row.collection_list_display_preferences
  );
  if (collectionListDisplayPreferences) settings.collectionListDisplayPreferences = collectionListDisplayPreferences;

  return settings;
};

const parseCollectionListDisplayPreferences = (
  value: string | null
): CollectionListDisplayPreferencesModel | undefined => {
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isCollectionListDisplayPreferences(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
};

const isCollectionListDisplayPreferences = (value: unknown): value is CollectionListDisplayPreferencesModel => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.showYear === 'boolean' &&
    typeof candidate.showSharedIcon === 'boolean' &&
    typeof candidate.preferredRating === 'string' &&
    COLLECTION_LIST_DISPLAY_RATINGS.includes(
      candidate.preferredRating as CollectionListDisplayPreferencesModel['preferredRating']
    ) &&
    typeof candidate.imdbRatingFallback === 'boolean'
  );
};

export const upsertUserSettings = (
  db: Database.Database,
  usernameHash: string,
  settings: UserSettingsApiRequestModel
): void => {
  db.prepare(
    `INSERT INTO user_settings
     (username_hash, theme, animated_background, language, default_library_owner_share_code, collection_list_display_preferences)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(username_hash) DO UPDATE SET
       theme = excluded.theme,
       animated_background = excluded.animated_background,
       language = excluded.language,
       default_library_owner_share_code = excluded.default_library_owner_share_code,
       collection_list_display_preferences = excluded.collection_list_display_preferences`
  ).run(
    usernameHash,
    settings.theme ?? null,
    settings.animatedBackground === undefined ? null : settings.animatedBackground ? 1 : 0,
    settings.language ?? null,
    settings.defaultLibraryOwnerShareCode ?? null,
    settings.collectionListDisplayPreferences ? JSON.stringify(settings.collectionListDisplayPreferences) : null
  );
};

export const deleteUserSettings = (db: Database.Database, usernameHash: string): void => {
  db.prepare('DELETE FROM user_settings WHERE username_hash = ?').run(usernameHash);
};
