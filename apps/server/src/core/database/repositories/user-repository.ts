import Database from 'better-sqlite3';
import {
  AccessTokenModel,
  CollectionOwnerDefaultModel,
  RefreshTokenModel,
  UserSettingsApiResponseModel,
  UserSettingsApiRequestModel,
} from '@shared/models/api-model';
import {
  CollectionListDisplayPreferencesModel,
  COLLECTION_LIST_DISPLAY_RATINGS,
} from '@shared/models/collection-list-display-preferences-model';
import { CollectionFeaturePreferencesModel } from '@shared/models/collection-feature-preferences-model';
import { parseCollectionFeaturePreferences as parseFeaturePreferences } from '@shared/utils/collection-feature-preferences-util';
import { hashText } from '../../crypto';
import { UserRow } from './user-model';

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
        collection_list_display_preferences: string | null;
        collection_feature_preferences: string | null;
      }
    | undefined;

  if (!row) return undefined;

  const settings: UserSettingsApiResponseModel = {};
  if (row.theme) settings.theme = row.theme as UserSettingsApiResponseModel['theme'];
  if (row.animated_background !== null) settings.animatedBackground = row.animated_background === 1;
  if (row.language) settings.language = row.language as UserSettingsApiResponseModel['language'];
  const defaultCollectionOwners = db
    .prepare(
      `SELECT defaults.list_type, defaults.content_type, defaults.owner_username_hash
       FROM collection_owner_defaults defaults
       WHERE username_hash = ?
       ORDER BY list_type, content_type`
    )
    .all(usernameHash)
    .map((defaultRow) => {
      const typedRow = defaultRow as {
        list_type: CollectionOwnerDefaultModel['listType'];
        content_type: CollectionOwnerDefaultModel['contentType'];
        owner_username_hash: string;
      };
      return {
        listType: typedRow.list_type,
        contentType: typedRow.content_type,
        ownerUserShareCode: getUserShareCode(typedRow.owner_username_hash),
      };
    });
  if (defaultCollectionOwners.length) settings.defaultCollectionOwners = defaultCollectionOwners;
  const collectionListDisplayPreferences = parseCollectionListDisplayPreferences(
    row.collection_list_display_preferences
  );
  if (collectionListDisplayPreferences) settings.collectionListDisplayPreferences = collectionListDisplayPreferences;
  const collectionFeaturePreferences = parseCollectionFeaturePreferences(row.collection_feature_preferences);
  if (collectionFeaturePreferences) settings.collectionFeaturePreferences = collectionFeaturePreferences;

  return settings;
};

const parseCollectionFeaturePreferences = (value: string | null): CollectionFeaturePreferencesModel | undefined => {
  if (!value) return undefined;

  try {
    return parseFeaturePreferences(JSON.parse(value) as unknown);
  } catch {
    return undefined;
  }
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
  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO user_settings
       (username_hash, theme, animated_background, language, default_library_owner_share_code, collection_list_display_preferences, collection_feature_preferences)
       VALUES (?, ?, ?, ?, NULL, ?, ?)
       ON CONFLICT(username_hash) DO UPDATE SET
         theme = excluded.theme,
         animated_background = excluded.animated_background,
         language = excluded.language,
         default_library_owner_share_code = NULL,
         collection_list_display_preferences = excluded.collection_list_display_preferences,
         collection_feature_preferences = excluded.collection_feature_preferences`
    ).run(
      usernameHash,
      settings.theme ?? null,
      settings.animatedBackground === undefined ? null : settings.animatedBackground ? 1 : 0,
      settings.language ?? null,
      settings.collectionListDisplayPreferences ? JSON.stringify(settings.collectionListDisplayPreferences) : null,
      settings.collectionFeaturePreferences ? JSON.stringify(settings.collectionFeaturePreferences) : null
    );

    db.prepare('DELETE FROM collection_owner_defaults WHERE username_hash = ?').run(usernameHash);
    const insertDefault = db.prepare(
      `INSERT INTO collection_owner_defaults (username_hash, list_type, content_type, owner_username_hash)
       VALUES (?, ?, ?, ?)`
    );
    for (const ownerDefault of settings.defaultCollectionOwners ?? []) {
      const owner = findUserByShareCode(db, ownerDefault.ownerUserShareCode);
      if (owner) insertDefault.run(usernameHash, ownerDefault.listType, ownerDefault.contentType, owner.username_hash);
    }
  });
  run();
};

export const deleteUserSettings = (db: Database.Database, usernameHash: string): void => {
  const run = db.transaction(() => {
    db.prepare('DELETE FROM collection_owner_defaults WHERE username_hash = ?').run(usernameHash);
    db.prepare('DELETE FROM user_settings WHERE username_hash = ?').run(usernameHash);
  });
  run();
};
