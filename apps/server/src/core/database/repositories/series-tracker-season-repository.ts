import { SeriesTrackerSeasonMetadataModel } from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { resolveCanonicalItemId } from './external-item-identity-repository';
import { SeriesTrackerSeasonRow } from './series-tracker-season-model';

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

const findSeriesTrackerItemIdByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): number | null => {
  const exactRow = db
    .prepare(
      `SELECT id
       FROM collection_items
       WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?`
    )
    .get(usernameHash, externalProvider, externalItemId, 'series-tracker') as { id: number } | undefined;
  if (exactRow) return exactRow.id;

  const canonicalItemId = resolveCanonicalItemId(db, usernameHash, externalProvider, externalItemId);
  const canonicalRow = db
    .prepare(
      `SELECT id
       FROM collection_items
       WHERE username_hash = ? AND canonical_item_id = ? AND list_type = ?`
    )
    .get(usernameHash, canonicalItemId, 'series-tracker') as { id: number } | undefined;
  return canonicalRow?.id ?? null;
};

const findSeriesTrackerSeasonsByItemId = (
  db: Database.Database,
  itemId: number | null
): SeriesTrackerSeasonMetadataModel[] => {
  if (!itemId) return [];
  return (
    db
      .prepare(
        `SELECT season, episodes, episode_titles
            FROM series_tracker_seasons
            WHERE item_id = ?
            ORDER BY season`
      )
      .all(itemId) as SeriesTrackerSeasonRow[]
  ).map((row) => {
    const titles = row.episode_titles ? (JSON.parse(row.episode_titles) as string[]) : [];
    return { season: row.season, episodes: row.episodes, titles };
  });
};

export const findSeriesTrackerSeasons = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): SeriesTrackerSeasonMetadataModel[] => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
  return findSeriesTrackerSeasonsByItemId(db, itemId);
};

export const findSeriesTrackerSeasonsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): SeriesTrackerSeasonMetadataModel[] => {
  const itemId = findSeriesTrackerItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  return findSeriesTrackerSeasonsByItemId(db, itemId);
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
      `INSERT INTO series_tracker_seasons (item_id, season, episodes, episode_titles)
       VALUES (?, ?, ?, ?)`
    );
    for (const season of seasons) {
      const titlesJson = season.titles?.length ? JSON.stringify(season.titles) : null;
      insert.run(itemId, season.season, season.episodes, titlesJson);
    }
  });

  transaction();
  return findSeriesTrackerSeasons(db, usernameHash, imdbId);
};

export const replaceSeriesTrackerSeasonsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  seasons: SeriesTrackerSeasonMetadataModel[]
): SeriesTrackerSeasonMetadataModel[] => {
  const itemId = findSeriesTrackerItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return [];

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM series_tracker_seasons WHERE item_id = ?').run(itemId);

    const insert = db.prepare(
      `INSERT INTO series_tracker_seasons (item_id, season, episodes, episode_titles)
       VALUES (?, ?, ?, ?)`
    );
    for (const season of seasons) {
      const titlesJson = season.titles?.length ? JSON.stringify(season.titles) : null;
      insert.run(itemId, season.season, season.episodes, titlesJson);
    }
  });

  transaction();
  return findSeriesTrackerSeasonsByExternalId(db, usernameHash, externalProvider, externalItemId);
};

export const deleteSeriesTrackerSeasons = (db: Database.Database, usernameHash: string, imdbId: string): void => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_tracker_seasons WHERE item_id = ?').run(itemId);
};

export const deleteSeriesTrackerSeasonsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): void => {
  const itemId = findSeriesTrackerItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_tracker_seasons WHERE item_id = ?').run(itemId);
};
