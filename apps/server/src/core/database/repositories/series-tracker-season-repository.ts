import { WatchingSeasonMetadataModel } from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { resolveCanonicalItemId } from './external-item-identity-repository';
import { WatchingSeasonRow } from './series-tracker-season-model';

const findWatchingItemId = (db: Database.Database, usernameHash: string, imdbId: string): number | null => {
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
    .get(usernameHash, 'watching', imdbId, imdbId) as { id: number } | undefined;
  return row?.id ?? null;
};

const findWatchingItemIdByExternalId = (
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
    .get(usernameHash, externalProvider, externalItemId, 'watching') as { id: number } | undefined;
  if (exactRow) return exactRow.id;

  const canonicalItemId = resolveCanonicalItemId(db, usernameHash, externalProvider, externalItemId);
  const canonicalRow = db
    .prepare(
      `SELECT id
       FROM collection_items
       WHERE username_hash = ? AND canonical_item_id = ? AND list_type = ?`
    )
    .get(usernameHash, canonicalItemId, 'watching') as { id: number } | undefined;
  return canonicalRow?.id ?? null;
};

const findWatchingSeasonsByItemId = (db: Database.Database, itemId: number | null): WatchingSeasonMetadataModel[] => {
  if (!itemId) return [];
  return (
    db
      .prepare(
        `SELECT season, episodes, episode_titles
            FROM series_tracker_seasons
            WHERE item_id = ?
            ORDER BY season`
      )
      .all(itemId) as WatchingSeasonRow[]
  ).map((row) => {
    const titles = row.episode_titles ? (JSON.parse(row.episode_titles) as string[]) : [];
    return { season: row.season, episodes: row.episodes, titles };
  });
};

export const findWatchingSeasons = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): WatchingSeasonMetadataModel[] => {
  const itemId = findWatchingItemId(db, usernameHash, imdbId);
  return findWatchingSeasonsByItemId(db, itemId);
};

export const findWatchingSeasonsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): WatchingSeasonMetadataModel[] => {
  const itemId = findWatchingItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  return findWatchingSeasonsByItemId(db, itemId);
};

export const replaceWatchingSeasons = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  seasons: WatchingSeasonMetadataModel[]
): WatchingSeasonMetadataModel[] => {
  const itemId = findWatchingItemId(db, usernameHash, imdbId);
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
  return findWatchingSeasons(db, usernameHash, imdbId);
};

export const replaceWatchingSeasonsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  seasons: WatchingSeasonMetadataModel[]
): WatchingSeasonMetadataModel[] => {
  const itemId = findWatchingItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
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
  return findWatchingSeasonsByExternalId(db, usernameHash, externalProvider, externalItemId);
};

export const deleteWatchingSeasons = (db: Database.Database, usernameHash: string, imdbId: string): void => {
  const itemId = findWatchingItemId(db, usernameHash, imdbId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_tracker_seasons WHERE item_id = ?').run(itemId);
};

export const deleteWatchingSeasonsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): void => {
  const itemId = findWatchingItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_tracker_seasons WHERE item_id = ?').run(itemId);
};
