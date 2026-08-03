import { CollectionItemSuggestionApiModel, CollectionListTypeModel } from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { escapeLike, normalizeLimit } from './collection-query';

export const findCollectionItemSuggestions = (
  db: Database.Database,
  usernameHashes: string[],
  query: string,
  limit: number,
  listType: CollectionListTypeModel = 'library'
): CollectionItemSuggestionApiModel[] => {
  const normalizedLimit = normalizeLimit(limit);
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return [];

  if (lowerQuery.startsWith('#')) {
    return findTagSuggestions(db, usernameHashes, query, normalizedLimit, listType).map((tag) => ({
      label: tag,
      value: tag,
      kind: 'tag',
    }));
  }

  const likeQuery = `%${escapeLike(lowerQuery)}%`;
  const rows = db
    .prepare(
      `SELECT external_item_id, title,
         COALESCE(
            CASE
              WHEN external_provider IN ('imdb', 'omdb')
                AND LOWER(external_item_id) GLOB 'tt[0-9]*'
                AND LOWER(SUBSTR(external_item_id, 3)) NOT GLOB '*[^0-9]*'
              THEN LOWER(external_item_id)
            END,
            (
             SELECT imdb_identity.external_item_id
             FROM external_item_identities imdb_identity
             WHERE imdb_identity.username_hash = collection_items.username_hash
               AND imdb_identity.canonical_item_id = collection_items.canonical_item_id
               AND imdb_identity.external_provider = 'imdb'
              ORDER BY imdb_identity.source_confidence = 'primary' DESC,
                imdb_identity.created_at,
                imdb_identity.external_item_id
              LIMIT 1
            )
          ) AS imdb_id
       FROM collection_items
       WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')})
       AND list_type = ?
       AND (
          title_lower LIKE ? ESCAPE '\\'
           OR LOWER(external_item_id) LIKE ? ESCAPE '\\'
           OR LOWER(contributors) LIKE ? ESCAPE '\\'
           OR LOWER(description) LIKE ? ESCAPE '\\'
           OR EXISTS (
             SELECT 1 FROM external_item_identities suggestion_identities
             WHERE suggestion_identities.username_hash = collection_items.username_hash
               AND suggestion_identities.canonical_item_id = collection_items.canonical_item_id
               AND LOWER(suggestion_identities.external_item_id) LIKE ? ESCAPE '\\'
           )
           OR EXISTS (
             SELECT 1 FROM collection_item_external_ratings suggestion_ratings
             WHERE suggestion_ratings.item_id = collection_items.id
               AND LOWER(suggestion_ratings.value) LIKE ? ESCAPE '\\'
           )
         )
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(
      ...usernameHashes,
      listType,
      likeQuery,
      likeQuery,
      likeQuery,
      likeQuery,
      likeQuery,
      likeQuery,
      normalizedLimit
    ) as Array<{
    imdb_id: string | null;
    external_item_id: string | null;
    title: string;
  }>;

  return rows.map((row) => ({
    label: row.title,
    value: row.imdb_id || row.external_item_id || row.title,
    kind: 'title',
  }));
};

export const findTagSuggestions = (
  db: Database.Database,
  usernameHashes: string[],
  query: string,
  limit: number,
  listType: CollectionListTypeModel = 'library'
): string[] => {
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return [];

  const rows = db
    .prepare(
      `SELECT tag, COUNT(*) as count
       FROM collection_item_tags
       INNER JOIN collection_items ON collection_items.id = collection_item_tags.item_id
       WHERE collection_items.username_hash IN (${usernameHashes.map(() => '?').join(', ')})
       AND collection_items.list_type = ?
       AND LOWER(tag) LIKE ? ESCAPE '\\'
        GROUP BY tag
       ORDER BY count DESC, tag
       LIMIT ?`
    )
    .all(...usernameHashes, listType, `${escapeLike(lowerQuery)}%`, normalizeLimit(limit)) as Array<{
    tag: string;
  }>;

  return rows.map((row) => row.tag);
};

export const findGenreSuggestions = (
  db: Database.Database,
  usernameHashes: string[],
  query: string,
  limit: number
): string[] => {
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return [];

  const rows = db
    .prepare(
      `SELECT genre, COUNT(*) as count
       FROM collection_item_genres
       INNER JOIN collection_items ON collection_items.id = collection_item_genres.item_id
       WHERE collection_items.username_hash IN (${usernameHashes.map(() => '?').join(', ')})
       AND collection_items.list_type = ?
       AND LOWER(genre) LIKE ? ESCAPE '\\'
       GROUP BY genre
       ORDER BY count DESC, genre
       LIMIT ?`
    )
    .all(...usernameHashes, 'library', `${escapeLike(lowerQuery)}%`, normalizeLimit(limit)) as Array<{ genre: string }>;

  return rows.map((row) => row.genre);
};
