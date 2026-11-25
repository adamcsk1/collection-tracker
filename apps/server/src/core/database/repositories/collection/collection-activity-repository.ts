import type { CollectionActivityApiModel, CollectionItemTypeFilter } from '@shared/models/api-model';
import type Database from 'better-sqlite3';
import { buildActivityWhere } from './collection-query';

export const getCollectionActivity = (
  database: Database.Database,
  viewerUsernameHash: string,
  year: number,
  type?: CollectionItemTypeFilter
): CollectionActivityApiModel => {
  const count = (activityStatus: 'planned' | 'completed' | 'inProgress'): number => {
    const query = buildActivityWhere(viewerUsernameHash, { activityYear: year, activityStatus, type });
    return (
      database
        .prepare(`SELECT COUNT(*) AS count FROM collection_items WHERE ${query.where.join(' AND ')}`)
        .get(...query.params) as { count: number }
    ).count;
  };
  const query = buildActivityWhere(viewerUsernameHash, { activityYear: year, activityStatus: 'completed', type });
  const monthlyCounts = database
    .prepare(
      `
    SELECT CAST(SUBSTR(tracker_state.completed_at, 6, 2) AS INTEGER) AS month, COUNT(*) AS count
    FROM collection_items
    JOIN collection_item_tracker_state tracker_state ON tracker_state.item_id = collection_items.id
    WHERE ${query.where.join(' AND ')}
    GROUP BY month
  `
    )
    .all(...query.params) as Array<{ month: number; count: number }>;
  return {
    year,
    planned: count('planned'),
    completed: count('completed'),
    inProgress: count('inProgress'),
    months: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      count: monthlyCounts.find((entry) => entry.month === index + 1)?.count ?? 0,
    })),
  };
};
