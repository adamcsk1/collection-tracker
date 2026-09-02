import {
  CollectionItemFiltersApiModel,
  CollectionItemTypeFilter,
  CollectionStatisticsApiResponseModel,
} from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { buildItemWhere, canonicalOrExactIdentityMatch } from './collection-query';
import type { AllSummaryRow, SpecificSummaryRow } from './collection-statistics-model';

export const getCollectionStatistics = (
  db: Database.Database,
  viewerUsernameHash: string,
  filters?: CollectionItemFiltersApiModel
): CollectionStatisticsApiResponseModel => {
  const scope: 'all' | CollectionItemTypeFilter = filters?.type ?? 'all';
  const queryParts = buildItemWhere(viewerUsernameHash, scope === 'all' ? undefined : { type: scope });
  const whereSql = queryParts.where.join(' AND ');
  const matchingItemsSql = `SELECT id FROM collection_items WHERE ${whereSql}`;

  const trackerExists = (stateCondition?: string): string => `EXISTS (
    SELECT 1
    FROM collection_items current_viewer_tracker
    ${stateCondition === undefined ? '' : 'LEFT JOIN collection_item_tracker_state tracker_state ON tracker_state.item_id = current_viewer_tracker.id'}
    WHERE current_viewer_tracker.username_hash = ?
      AND current_viewer_tracker.list_type = 'tracking'
      AND current_viewer_tracker.content_type = collection_items.content_type
      AND ${canonicalOrExactIdentityMatch('current_viewer_tracker')}
      ${stateCondition === undefined ? '' : `AND ${stateCondition}`}
  )`;

  let specificSummary: SpecificSummaryRow | undefined;
  if (scope !== 'all') {
    const trackedCondition = trackerExists();
    const completedCondition = trackerExists('tracker_state.completed_at IS NOT NULL');
    const inProgressCondition = trackerExists(
      scope === 'book' || scope === 'album'
        ? 'tracker_state.completed_at IS NULL AND COALESCE(tracker_state.progress_current, 0) > 0'
        : 'tracker_state.completed_at IS NULL'
    );
    specificSummary = db
      .prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(collection_items.favorite = 1), 0) AS favorites,
                COALESCE(SUM(${trackedCondition}), 0) AS tracked,
                COALESCE(SUM(${completedCondition}), 0) AS completed,
                COALESCE(SUM(${inProgressCondition}), 0) AS in_progress
         FROM collection_items
         WHERE ${whereSql}`
      )
      .get(viewerUsernameHash, viewerUsernameHash, viewerUsernameHash, ...queryParts.params) as SpecificSummaryRow;
  }

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

  const releaseYearCounts = db
    .prepare(
      `SELECT year, COUNT(*) AS count
       FROM collection_items
       WHERE id IN (${matchingItemsSql})
         AND LENGTH(year) = 4
         AND year GLOB '[0-9][0-9][0-9][0-9]'
       GROUP BY year
       ORDER BY year`
    )
    .all(...queryParts.params) as Array<{ year: string; count: number }>;

  const userRatingCounts = db
    .prepare(
      `SELECT CAST(user_rate AS INTEGER) AS rating, COUNT(*) AS count
       FROM collection_items
       WHERE id IN (${matchingItemsSql})
         AND user_rate IS NOT NULL
        GROUP BY rating
        ORDER BY rating`
    )
    .all(...queryParts.params) as Array<{ rating: number; count: number }>;

  const mediaTypeCounts =
    scope === 'all'
      ? (db
          .prepare(
            `SELECT content_type AS type, COUNT(*) AS count
             FROM collection_items
             WHERE id IN (${matchingItemsSql})
             GROUP BY content_type
                           ORDER BY CASE content_type WHEN 'movie' THEN 1 WHEN 'series' THEN 2 WHEN 'book' THEN 3 ELSE 4 END`
          )
          .all(...queryParts.params) as Array<{ type: CollectionItemTypeFilter; count: number }>)
      : [];

  const commonCharts = { tagCounts, genreCounts, releaseYearCounts, userRatingCounts };
  if (scope === 'all') {
    const summary = db
      .prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(collection_items.favorite = 1), 0) AS favorites,
                COALESCE(SUM(collection_items.content_type = 'movie'), 0) AS movies,
                COALESCE(SUM(collection_items.content_type = 'series'), 0) AS series,
                 COALESCE(SUM(collection_items.content_type = 'book'), 0) AS books,
                 COALESCE(SUM(collection_items.content_type = 'album'), 0) AS music
         FROM collection_items
         WHERE ${whereSql}`
      )
      .get(...queryParts.params) as AllSummaryRow;
    return { scope, summary, charts: { ...commonCharts, mediaTypeCounts, statusCounts: [] } };
  }

  const summary = specificSummary!;
  if (scope === 'movie') {
    const movieSummary = {
      total: summary.total,
      favorites: summary.favorites,
      watched: summary.completed,
      unwatched: summary.total - summary.completed,
    };
    return {
      scope,
      summary: movieSummary,
      charts: {
        ...commonCharts,
        mediaTypeCounts: [],
        statusCounts: [
          { status: 'watched', count: movieSummary.watched },
          { status: 'unwatched', count: movieSummary.unwatched },
        ],
      },
    };
  }
  if (scope === 'series') {
    const seriesSummary = {
      total: summary.total,
      favorites: summary.favorites,
      tracked: summary.tracked,
      untracked: summary.total - summary.tracked,
      completed: summary.completed,
      inProgress: summary.in_progress,
    };
    return {
      scope,
      summary: seriesSummary,
      charts: {
        ...commonCharts,
        mediaTypeCounts: [],
        statusCounts: [
          { status: 'untracked', count: seriesSummary.untracked },
          { status: 'completed', count: seriesSummary.completed },
          { status: 'inProgress', count: seriesSummary.inProgress },
        ],
      },
    };
  }

  if (scope === 'book') {
    const bookSummary = {
      total: summary.total,
      favorites: summary.favorites,
      read: summary.completed,
      unread: summary.total - summary.completed - summary.in_progress,
      inProgress: summary.in_progress,
    };
    return {
      scope,
      summary: bookSummary,
      charts: {
        ...commonCharts,
        mediaTypeCounts: [],
        statusCounts: [
          { status: 'read', count: bookSummary.read },
          { status: 'unread', count: bookSummary.unread },
          { status: 'inProgress', count: bookSummary.inProgress },
        ],
      },
    };
  }

  const albumSummary = {
    total: summary.total,
    favorites: summary.favorites,
    listened: summary.completed,
    unlistened: summary.total - summary.completed - summary.in_progress,
    inProgress: summary.in_progress,
  };
  return {
    scope,
    summary: albumSummary,
    charts: {
      ...commonCharts,
      mediaTypeCounts: [],
      statusCounts: [
        { status: 'listened', count: albumSummary.listened },
        { status: 'unlistened', count: albumSummary.unlistened },
        { status: 'inProgress', count: albumSummary.inProgress },
      ],
    },
  };
};
