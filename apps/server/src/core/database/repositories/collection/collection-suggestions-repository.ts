import { VIRTUAL_TAGS } from '@shared/constants/tags-const';
import { CollectionItemSuggestionApiModel, CollectionListTypeModel } from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { escapeLike, normalizeLimit } from './collection-query';
import { INTERNAL_TAGS, SUGGESTION_SYSTEM_TAGS } from './collection-tags';

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
    const systemTagSuggestions = SUGGESTION_SYSTEM_TAGS.filter((tag) => tag.startsWith(lowerQuery));
    const remainingLimit = normalizedLimit - systemTagSuggestions.length;
    const customTagSuggestions =
      remainingLimit > 0 ? findTagSuggestions(db, usernameHashes, query, remainingLimit, false, listType) : [];

    return [...systemTagSuggestions, ...customTagSuggestions]
      .slice(0, normalizedLimit)
      .map((tag) => ({ label: tag, value: tag, kind: 'tag' }));
  }

  const likeQuery = `%${escapeLike(lowerQuery)}%`;
  const rows = db
    .prepare(
      `SELECT imdb_id, title
       FROM collection_items
       WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')})
       AND list_type = ?
       AND (
         title_lower LIKE ? ESCAPE '\\'
         OR LOWER(imdb_id) LIKE ? ESCAPE '\\'
         OR LOWER(actors) LIKE ? ESCAPE '\\'
         OR LOWER(plot) LIKE ? ESCAPE '\\'
        )
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(...usernameHashes, listType, likeQuery, likeQuery, likeQuery, likeQuery, normalizedLimit) as Array<{
    imdb_id: string;
    title: string;
  }>;

  return rows.map((row) => ({ label: row.title, value: row.imdb_id || row.title, kind: 'title' }));
};

export const findTagSuggestions = (
  db: Database.Database,
  usernameHashes: string[],
  query: string,
  limit: number,
  includeInternal = false,
  listType: CollectionListTypeModel = 'library'
): string[] => {
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return [];

  const excludedTags = includeInternal ? [] : [...INTERNAL_TAGS, ...VIRTUAL_TAGS];
  const excludedSql = excludedTags.length ? `AND tag NOT IN (${excludedTags.map(() => '?').join(', ')})` : '';

  const rows = db
    .prepare(
      `SELECT tag, COUNT(*) as count
       FROM collection_item_tags
       INNER JOIN collection_items ON collection_items.id = collection_item_tags.item_id
       WHERE collection_items.username_hash IN (${usernameHashes.map(() => '?').join(', ')})
       AND collection_items.list_type = ?
       AND LOWER(tag) LIKE ? ESCAPE '\\'
       ${excludedSql}
       GROUP BY tag
       ORDER BY count DESC, tag
       LIMIT ?`
    )
    .all(...usernameHashes, listType, `${escapeLike(lowerQuery)}%`, ...excludedTags, normalizeLimit(limit)) as Array<{
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
