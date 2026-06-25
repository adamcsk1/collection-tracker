import { COMPLETED_TAG, FAVORITE_TAG, MOVIE_TAG, SERIES_TAG, VIRTUAL_TAGS } from '@shared/constants/tags-const';
import {
  CollectionItemFiltersApiModel,
  CollectionListTypeModel,
  CollectionStatisticsApiResponseModel,
} from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { buildItemWhere } from './collection-query';
import { INTERNAL_TAGS } from './collection-tags';

interface WatchedYearCountRow {
  watched_year: string;
  count: number;
}

export const getCollectionStatistics = (
  db: Database.Database,
  usernameHashes: string[],
  filters?: CollectionItemFiltersApiModel,
  internalCollectionUsernameHash?: string
): CollectionStatisticsApiResponseModel => {
  const viewerUsernameHash = internalCollectionUsernameHash ?? usernameHashes[0];
  const queryParts = buildItemWhere(usernameHashes, filters, undefined, viewerUsernameHash);
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

  const watchedMovieCount = (
    db
      .prepare(
        `SELECT COUNT(*) as count
         FROM collection_items
         WHERE ${whereSql}
           AND EXISTS (
             SELECT 1 FROM collection_item_tags
             WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
           )
           AND EXISTS (
             SELECT 1 FROM collection_items movie_tracker
             WHERE movie_tracker.username_hash = ?
               AND movie_tracker.imdb_id = collection_items.imdb_id
               AND movie_tracker.list_type = ?
           )`
      )
      .get(...queryParts.params, MOVIE_TAG, viewerUsernameHash, 'movie-tracker') as { count: number }
  ).count;

  const unwatchedMovieCount = (
    db
      .prepare(
        `SELECT COUNT(*) as count
         FROM collection_items
         WHERE ${whereSql}
           AND EXISTS (
             SELECT 1 FROM collection_item_tags
             WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
           )
           AND NOT EXISTS (
             SELECT 1 FROM collection_items movie_tracker
             WHERE movie_tracker.username_hash = ?
               AND movie_tracker.imdb_id = collection_items.imdb_id
               AND movie_tracker.list_type = ?
           )`
      )
      .get(...queryParts.params, MOVIE_TAG, viewerUsernameHash, 'movie-tracker') as { count: number }
  ).count;

  const watchedSeriesCount = (
    db
      .prepare(
        `SELECT COUNT(*) as count
         FROM collection_items
         WHERE ${whereSql}
           AND EXISTS (
             SELECT 1 FROM collection_item_tags
             WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
           )
           AND EXISTS (
             SELECT 1 FROM collection_items series_tracker
             WHERE series_tracker.username_hash = ?
               AND series_tracker.imdb_id = collection_items.imdb_id
               AND series_tracker.list_type = ?
           )`
      )
      .get(...queryParts.params, SERIES_TAG, viewerUsernameHash, 'series-tracker') as { count: number }
  ).count;

  const unwatchedLibrarySeriesCount = (
    db
      .prepare(
        `SELECT COUNT(*) as count
         FROM collection_items
         WHERE ${whereSql}
           AND EXISTS (
             SELECT 1 FROM collection_item_tags
             WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
           )
           AND NOT EXISTS (
             SELECT 1 FROM collection_items series_tracker
             WHERE series_tracker.username_hash = ?
               AND series_tracker.imdb_id = collection_items.imdb_id
               AND series_tracker.list_type = ?
           )`
      )
      .get(...queryParts.params, SERIES_TAG, viewerUsernameHash, 'series-tracker') as { count: number }
  ).count;

  const shouldCountTrackerSeries = !filters?.listType || filters.listType === 'series-tracker';
  const trackerQueryParts = buildItemWhere(
    usernameHashes,
    { ...filters, listType: 'series-tracker' },
    undefined,
    viewerUsernameHash
  );
  const trackerWhereSql = trackerQueryParts.where.join(' AND ');

  const unwatchedTrackerSeriesCount = shouldCountTrackerSeries
    ? (
        db
          .prepare(
            `SELECT COUNT(*) as count
             FROM collection_items
             WHERE ${trackerWhereSql}
               AND NOT EXISTS (
                 SELECT 1 FROM collection_item_tags
                 WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
               )`
          )
          .get(...trackerQueryParts.params, COMPLETED_TAG) as { count: number }
      ).count
    : 0;

  const completedTrackerSeriesCount = shouldCountTrackerSeries
    ? (
        db
          .prepare(
            `SELECT COUNT(*) as count
             FROM collection_items
             WHERE ${trackerWhereSql}
               AND EXISTS (
                 SELECT 1 FROM collection_item_tags
                 WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
               )`
          )
          .get(...trackerQueryParts.params, COMPLETED_TAG) as { count: number }
      ).count
    : 0;

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

  const watchedMovieYearCounts = db
    .prepare(
      `SELECT strftime('%Y', movie_tracker.watched_at) as watched_year, COUNT(*) as count
       FROM collection_items
       INNER JOIN collection_items movie_tracker
         ON movie_tracker.username_hash = ?
        AND movie_tracker.imdb_id = collection_items.imdb_id
        AND movie_tracker.list_type = ?
        AND movie_tracker.watched_at IS NOT NULL
       WHERE ${whereSql}
         AND EXISTS (
           SELECT 1 FROM collection_item_tags
           WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
         )
        GROUP BY watched_year`
    )
    .all(viewerUsernameHash, 'movie-tracker', ...queryParts.params, MOVIE_TAG) as WatchedYearCountRow[];

  const watchedSeriesYearCounts = db
    .prepare(
      `SELECT strftime('%Y', series_tracker.watched_at) as watched_year, COUNT(*) as count
       FROM collection_items
       INNER JOIN collection_items series_tracker
         ON series_tracker.username_hash = ?
        AND series_tracker.imdb_id = collection_items.imdb_id
        AND series_tracker.list_type = ?
        AND series_tracker.watched_at IS NOT NULL
       WHERE ${whereSql}
         AND EXISTS (
           SELECT 1 FROM collection_item_tags
           WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
         )
        GROUP BY watched_year`
    )
    .all(viewerUsernameHash, 'series-tracker', ...queryParts.params, SERIES_TAG) as WatchedYearCountRow[];

  const watchedYearCountMap = new Map<
    string,
    { year: string; movieCount: number; seriesCount: number; count: number }
  >();
  for (const row of watchedMovieYearCounts) {
    watchedYearCountMap.set(row.watched_year, {
      year: row.watched_year,
      movieCount: row.count,
      seriesCount: 0,
      count: row.count,
    });
  }
  for (const row of watchedSeriesYearCounts) {
    const existingCount = watchedYearCountMap.get(row.watched_year) ?? {
      year: row.watched_year,
      movieCount: 0,
      seriesCount: 0,
      count: 0,
    };
    existingCount.seriesCount = row.count;
    existingCount.count = existingCount.movieCount + existingCount.seriesCount;
    watchedYearCountMap.set(row.watched_year, existingCount);
  }

  const watchedYearCounts = [...watchedYearCountMap.values()].sort((a, b) => a.year.localeCompare(b.year));

  return {
    totalItems,
    movieCount: countTag(MOVIE_TAG),
    seriesCount: countTag(SERIES_TAG),
    favoriteCount: countTag(FAVORITE_TAG),
    watchLaterCount,
    wishlistCount,
    watchedMovieCount,
    watchedSeriesCount,
    unwatchedMovieCount,
    unwatchedLibrarySeriesCount,
    unwatchedTrackerSeriesCount,
    completedTrackerSeriesCount,
    watchedYearCounts,
    tagCounts,
    genreCounts,
  };
};
