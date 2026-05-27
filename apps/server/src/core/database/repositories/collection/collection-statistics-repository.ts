import { FAVORITE_TAG, MOVIE_TAG, SERIES_TAG, VIRTUAL_TAGS, WATCHED_TAG } from '@shared/constants/tags-const';
import {
  CollectionItemFiltersApiModel,
  CollectionListTypeModel,
  CollectionStatisticsApiResponseModel,
} from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { buildItemWhere } from './collection-query';
import { INTERNAL_TAGS } from './collection-tags';

export const getCollectionStatistics = (
  db: Database.Database,
  usernameHashes: string[],
  filters?: CollectionItemFiltersApiModel,
  internalCollectionUsernameHash?: string
): CollectionStatisticsApiResponseModel => {
  const queryParts = buildItemWhere(usernameHashes, filters);
  const whereSql = queryParts.where.join(' AND ');
  const matchingItemsSql = `SELECT id FROM collection_items WHERE ${whereSql}`;
  const countTag = (tag: string, exists = true): number =>
    (
      db
        .prepare(
          `SELECT COUNT(*) as count
           FROM collection_items
           WHERE ${whereSql}
           AND ${exists ? '' : 'NOT '}EXISTS (
             SELECT 1 FROM collection_item_tags
             WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
           )`
        )
        .get(...queryParts.params, tag) as { count: number }
    ).count;

  const totalItems = (
    db.prepare(`SELECT COUNT(*) as count FROM collection_items WHERE ${whereSql}`).get(...queryParts.params) as {
      count: number;
    }
  ).count;

  const countListType = (listType: CollectionListTypeModel): number =>
    (
      db
        .prepare(
          `SELECT COUNT(*) as count
           FROM collection_items
           WHERE username_hash = ?
           AND list_type = ?`
        )
        .get(internalCollectionUsernameHash ?? usernameHashes[0], listType) as { count: number }
    ).count;

  const watchLaterCount = countListType('watch-later');
  const wishlistCount = countListType('wishlist');

  const tagCounts = db
    .prepare(
      `SELECT tag, COUNT(*) as count
       FROM collection_item_tags
       WHERE item_id IN (${matchingItemsSql})
       AND tag NOT IN (${[...INTERNAL_TAGS, ...VIRTUAL_TAGS].map(() => '?').join(', ')})
       GROUP BY tag
       ORDER BY count DESC, tag`
    )
    .all(...queryParts.params, ...INTERNAL_TAGS, ...VIRTUAL_TAGS) as Array<{ tag: string; count: number }>;

  const genreCounts = db
    .prepare(
      `SELECT genre, COUNT(*) as count
       FROM collection_item_genres
       WHERE item_id IN (${matchingItemsSql})
       GROUP BY genre
       ORDER BY count DESC, genre`
    )
    .all(...queryParts.params) as Array<{ genre: string; count: number }>;

  return {
    totalItems,
    movieCount: countTag(MOVIE_TAG),
    seriesCount: countTag(SERIES_TAG),
    favoriteCount: countTag(FAVORITE_TAG),
    watchLaterCount,
    wishlistCount,
    watchedCount: countTag(WATCHED_TAG),
    unwatchedCount: countTag(WATCHED_TAG, false),
    tagCounts,
    genreCounts,
  };
};
