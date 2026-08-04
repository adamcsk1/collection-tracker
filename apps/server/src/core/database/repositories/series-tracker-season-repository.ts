import { TrackingSeasonMetadataModel } from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { resolveCanonicalItemId } from './external-item-identity-repository';
import { TrackingSeasonRow } from './series-tracker-season-model';

const findTrackingItemId = (db: Database.Database, usernameHash: string, imdbId: string): number | null => {
  const row = db
    .prepare(
      `SELECT id
       FROM collection_items
       WHERE username_hash = ?
         AND list_type = ?
         AND (
           (external_provider = 'imdb' AND external_item_id = ?)
           OR EXISTS (
             SELECT 1
             FROM external_item_identities imdb_identity
             WHERE imdb_identity.username_hash = collection_items.username_hash
               AND imdb_identity.canonical_item_id = collection_items.canonical_item_id
               AND imdb_identity.external_provider = 'imdb'
               AND imdb_identity.external_item_id = ?
           )
         )`
    )
    .get(usernameHash, 'tracking', imdbId, imdbId) as { id: number } | undefined;
  return row?.id ?? null;
};

const findTrackingItemIdByExternalId = (
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
    .get(usernameHash, externalProvider, externalItemId, 'tracking') as { id: number } | undefined;
  if (exactRow) return exactRow.id;

  const canonicalItemId = resolveCanonicalItemId(db, usernameHash, externalProvider, externalItemId);
  const canonicalRow = db
    .prepare(
      `SELECT id
       FROM collection_items
       WHERE username_hash = ? AND canonical_item_id = ? AND list_type = ?`
    )
    .get(usernameHash, canonicalItemId, 'tracking') as { id: number } | undefined;
  return canonicalRow?.id ?? null;
};

const findTrackingSeasonsByItemId = (db: Database.Database, itemId: number | null): TrackingSeasonMetadataModel[] => {
  if (!itemId) return [];
  return (
    db
      .prepare(
        `SELECT season, episodes, episode_titles
            FROM series_tracker_seasons
            WHERE item_id = ?
            ORDER BY season`
      )
      .all(itemId) as TrackingSeasonRow[]
  ).map((row) => {
    const titles = row.episode_titles ? (JSON.parse(row.episode_titles) as string[]) : [];
    return { season: row.season, episodes: row.episodes, titles };
  });
};

export const findTrackingSeasons = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): TrackingSeasonMetadataModel[] => {
  const itemId = findTrackingItemId(db, usernameHash, imdbId);
  return findTrackingSeasonsByItemId(db, itemId);
};

export const findTrackingSeasonsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): TrackingSeasonMetadataModel[] => {
  const itemId = findTrackingItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  return findTrackingSeasonsByItemId(db, itemId);
};

export const replaceTrackingSeasons = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  seasons: TrackingSeasonMetadataModel[]
): TrackingSeasonMetadataModel[] => {
  const itemId = findTrackingItemId(db, usernameHash, imdbId);
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
  return findTrackingSeasons(db, usernameHash, imdbId);
};

export const replaceTrackingSeasonsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  seasons: TrackingSeasonMetadataModel[]
): TrackingSeasonMetadataModel[] => {
  const itemId = findTrackingItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
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
  return findTrackingSeasonsByExternalId(db, usernameHash, externalProvider, externalItemId);
};

export const deleteTrackingSeasons = (db: Database.Database, usernameHash: string, imdbId: string): void => {
  const itemId = findTrackingItemId(db, usernameHash, imdbId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_tracker_seasons WHERE item_id = ?').run(itemId);
};

export const deleteTrackingSeasonsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): void => {
  const itemId = findTrackingItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_tracker_seasons WHERE item_id = ?').run(itemId);
};
