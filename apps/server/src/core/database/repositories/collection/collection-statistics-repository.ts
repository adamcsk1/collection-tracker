import {
  CollectionItemFiltersApiModel,
  CollectionListTypeModel,
  CollectionStatisticsApiResponseModel,
} from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { buildItemWhere, canonicalOrExactIdentityMatch } from './collection-query';
import { WatchedYearCountRow } from './collection-model';

const movieContentCondition = `collection_items.content_type = 'movie'`;

const seriesContentCondition = `collection_items.content_type = 'series'`;

const favoriteCondition = `collection_items.favorite = 1`;

export const getCollectionStatistics = (
  db: Database.Database,
  usernameHashes: string[],
  filters?: CollectionItemFiltersApiModel,
  internalCollectionUsernameHash?: string
): CollectionStatisticsApiResponseModel => {
  const viewerUsernameHash = internalCollectionUsernameHash ?? usernameHashes[0];
  const queryParts = buildItemWhere(usernameHashes, filters, undefined, undefined, viewerUsernameHash);
  const whereSql = queryParts.where.join(' AND ');
  const matchingItemsSql = `SELECT id FROM collection_items WHERE ${whereSql}`;
  const countWhere = (condition: string): number =>
    (
      db
        .prepare(
          `SELECT COUNT(*) as count
            FROM collection_items
            WHERE ${whereSql}
            AND ${condition}`
        )
        .get(...queryParts.params) as { count: number }
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
             AND ${movieContentCondition}
           AND EXISTS (
             SELECT 1 FROM collection_items movie_tracker
             WHERE movie_tracker.username_hash = ?
               AND ${canonicalOrExactIdentityMatch('movie_tracker')}
               AND movie_tracker.list_type = ?
           )`
      )
      .get(...queryParts.params, viewerUsernameHash, 'movie-tracker') as { count: number }
  ).count;

  const unwatchedMovieCount = (
    db
      .prepare(
        `SELECT COUNT(*) as count
         FROM collection_items
         WHERE ${whereSql}
             AND ${movieContentCondition}
           AND NOT EXISTS (
             SELECT 1 FROM collection_items movie_tracker
             WHERE movie_tracker.username_hash = ?
                AND ${canonicalOrExactIdentityMatch('movie_tracker')}
               AND movie_tracker.list_type = ?
           )`
      )
      .get(...queryParts.params, viewerUsernameHash, 'movie-tracker') as { count: number }
  ).count;

  const watchedSeriesCount = (
    db
      .prepare(
        `SELECT COUNT(*) as count
         FROM collection_items
         WHERE ${whereSql}
             AND ${seriesContentCondition}
           AND EXISTS (
             SELECT 1 FROM collection_items series_tracker
             WHERE series_tracker.username_hash = ?
                AND ${canonicalOrExactIdentityMatch('series_tracker')}
               AND series_tracker.list_type = ?
           )`
      )
      .get(...queryParts.params, viewerUsernameHash, 'series-tracker') as { count: number }
  ).count;

  const unwatchedLibrarySeriesCount = (
    db
      .prepare(
        `SELECT COUNT(*) as count
         FROM collection_items
         WHERE ${whereSql}
             AND ${seriesContentCondition}
           AND NOT EXISTS (
             SELECT 1 FROM collection_items series_tracker
             WHERE series_tracker.username_hash = ?
                AND ${canonicalOrExactIdentityMatch('series_tracker')}
               AND series_tracker.list_type = ?
           )`
      )
      .get(...queryParts.params, viewerUsernameHash, 'series-tracker') as { count: number }
  ).count;

  const shouldCountTrackerSeries = !filters?.listType || filters.listType === 'series-tracker';
  const trackerQueryParts = buildItemWhere(
    usernameHashes,
    { ...filters, listType: 'series-tracker' },
    undefined,
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
                AND collection_items.watched_at IS NULL`
          )
          .get(...trackerQueryParts.params) as { count: number }
      ).count
    : 0;

  const completedTrackerSeriesCount = shouldCountTrackerSeries
    ? (
        db
          .prepare(
            `SELECT COUNT(*) as count
             FROM collection_items
             WHERE ${trackerWhereSql}
                AND collection_items.watched_at IS NOT NULL`
          )
          .get(...trackerQueryParts.params) as { count: number }
      ).count
    : 0;

  const tagCounts = db
    .prepare(
      `SELECT tag, COUNT(*) as count
       FROM collection_item_tags
        WHERE item_id IN (${matchingItemsSql})
        GROUP BY tag
        ORDER BY count DESC, tag`
    )
    .all(...queryParts.params) as Array<{ tag: string; count: number }>;

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
        AND ${canonicalOrExactIdentityMatch('movie_tracker')}
        AND movie_tracker.list_type = ?
        AND movie_tracker.watched_at IS NOT NULL
       WHERE ${whereSql}
           AND ${movieContentCondition}
          GROUP BY watched_year`
    )
    .all(viewerUsernameHash, 'movie-tracker', ...queryParts.params) as WatchedYearCountRow[];

  const watchedSeriesYearCounts = db
    .prepare(
      `SELECT strftime('%Y', series_tracker.watched_at) as watched_year, COUNT(*) as count
       FROM collection_items
       INNER JOIN collection_items series_tracker
         ON series_tracker.username_hash = ?
        AND ${canonicalOrExactIdentityMatch('series_tracker')}
        AND series_tracker.list_type = ?
        AND series_tracker.watched_at IS NOT NULL
       WHERE ${whereSql}
           AND ${seriesContentCondition}
          GROUP BY watched_year`
    )
    .all(viewerUsernameHash, 'series-tracker', ...queryParts.params) as WatchedYearCountRow[];

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
    movieCount: countWhere(movieContentCondition),
    seriesCount: countWhere(seriesContentCondition),
    favoriteCount: countWhere(favoriteCondition),
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
