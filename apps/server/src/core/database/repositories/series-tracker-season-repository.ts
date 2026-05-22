import { SeriesTrackerSeasonMetadataModel } from '@shared/models/api-model';
import Database from 'better-sqlite3';

interface SeriesTrackerSeasonRow {
  season: number;
  episodes: number;
}

const findSeriesTrackerItemId = (db: Database.Database, usernameHash: string, imdbId: string): number | null => {
  const row = db
    .prepare(
      `SELECT id
       FROM collection_items
       WHERE username_hash = ? AND imdb_id = ? AND list_type = ?`
    )
    .get(usernameHash, imdbId, 'series-tracker') as { id: number } | undefined;
  return row?.id ?? null;
};

export const findSeriesTrackerSeasons = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): SeriesTrackerSeasonMetadataModel[] => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
  if (!itemId) return [];
  return (
    db
      .prepare(
        `SELECT season, episodes
           FROM series_tracker_seasons
           WHERE item_id = ?
           ORDER BY season`
      )
      .all(itemId) as SeriesTrackerSeasonRow[]
  ).map((row) => ({ season: row.season, episodes: row.episodes }));
};

export const replaceSeriesTrackerSeasons = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  seasons: SeriesTrackerSeasonMetadataModel[]
): SeriesTrackerSeasonMetadataModel[] => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
  if (!itemId) return [];

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM series_tracker_seasons WHERE item_id = ?').run(itemId);

    const insert = db.prepare(
      `INSERT INTO series_tracker_seasons (item_id, season, episodes)
       VALUES (?, ?, ?)`
    );
    for (const season of seasons) {
      insert.run(itemId, season.season, season.episodes);
    }
  });

  transaction();
  return findSeriesTrackerSeasons(db, usernameHash, imdbId);
};

export const deleteSeriesTrackerSeasons = (db: Database.Database, usernameHash: string, imdbId: string): void => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_tracker_seasons WHERE item_id = ?').run(itemId);
};
