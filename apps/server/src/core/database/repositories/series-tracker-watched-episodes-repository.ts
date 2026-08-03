import { SeriesTrackerSeasonMetadataModel, SeriesTrackerWatchedEpisodeModel } from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { resolveCanonicalItemId } from './external-item-identity-repository';
import { WatchedEpisodeRow } from './series-tracker-watched-episodes-model';

const findSeriesTrackerItemId = (db: Database.Database, usernameHash: string, imdbId: string): number | null => {
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
    .get(usernameHash, 'series-tracker', imdbId, imdbId) as { id: number } | undefined;
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

const findWatchedEpisodesByItemId = (
  db: Database.Database,
  itemId: number | null
): SeriesTrackerWatchedEpisodeModel[] => {
  if (!itemId) return [];
  return (
    db
      .prepare(
        `SELECT season, episode
         FROM series_tracker_watched_episodes
         WHERE item_id = ?
         ORDER BY season, episode`
      )
      .all(itemId) as WatchedEpisodeRow[]
  ).map((row) => ({ season: row.season, episode: row.episode }));
};

export const findWatchedEpisodes = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): SeriesTrackerWatchedEpisodeModel[] => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
  return findWatchedEpisodesByItemId(db, itemId);
};

export const findWatchedEpisodesByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): SeriesTrackerWatchedEpisodeModel[] => {
  const itemId = findSeriesTrackerItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  return findWatchedEpisodesByItemId(db, itemId);
};

export const findLastWatchedEpisode = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): { season: number; episode: number } | null => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
  if (!itemId) return null;
  const row = db
    .prepare(
      `SELECT season, episode
       FROM series_tracker_watched_episodes
       WHERE item_id = ?
       ORDER BY season DESC, episode DESC
       LIMIT 1`
    )
    .get(itemId) as WatchedEpisodeRow | undefined;
  return row ? { season: row.season, episode: row.episode } : null;
};

export const findLastWatchedEpisodeByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): { season: number; episode: number } | null => {
  const itemId = findSeriesTrackerItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return null;
  const row = db
    .prepare(
      `SELECT season, episode
       FROM series_tracker_watched_episodes
       WHERE item_id = ?
       ORDER BY season DESC, episode DESC
       LIMIT 1`
    )
    .get(itemId) as WatchedEpisodeRow | undefined;
  return row ? { season: row.season, episode: row.episode } : null;
};

export const replaceWatchedEpisodes = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  episodes: SeriesTrackerWatchedEpisodeModel[]
): SeriesTrackerWatchedEpisodeModel[] => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
  if (!itemId) return [];

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM series_tracker_watched_episodes WHERE item_id = ?').run(itemId);

    const insert = db.prepare(
      `INSERT INTO series_tracker_watched_episodes (item_id, season, episode)
       VALUES (?, ?, ?)`
    );
    for (const episode of episodes) {
      insert.run(itemId, episode.season, episode.episode);
    }
  });

  transaction();
  return findWatchedEpisodes(db, usernameHash, imdbId);
};

export const replaceWatchedEpisodesByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  episodes: SeriesTrackerWatchedEpisodeModel[]
): SeriesTrackerWatchedEpisodeModel[] => {
  const itemId = findSeriesTrackerItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return [];

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM series_tracker_watched_episodes WHERE item_id = ?').run(itemId);

    const insert = db.prepare(
      `INSERT INTO series_tracker_watched_episodes (item_id, season, episode)
       VALUES (?, ?, ?)`
    );
    for (const episode of episodes) {
      insert.run(itemId, episode.season, episode.episode);
    }
  });

  transaction();
  return findWatchedEpisodesByExternalId(db, usernameHash, externalProvider, externalItemId);
};

export const deleteWatchedEpisodesOutsideSeasons = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  seasons: SeriesTrackerSeasonMetadataModel[]
): SeriesTrackerWatchedEpisodeModel[] => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
  if (!itemId) return [];

  if (!seasons.length) {
    db.prepare('DELETE FROM series_tracker_watched_episodes WHERE item_id = ?').run(itemId);
    return [];
  }

  const availableEpisodes = new Set<string>();
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      availableEpisodes.add(`${season.season}-${episode}`);
    }
  }

  const watchedEpisodes = findWatchedEpisodes(db, usernameHash, imdbId);
  const prunedEpisodes = watchedEpisodes.filter((episode) =>
    availableEpisodes.has(`${episode.season}-${episode.episode}`)
  );
  if (prunedEpisodes.length === watchedEpisodes.length) return watchedEpisodes;

  return replaceWatchedEpisodes(db, usernameHash, imdbId, prunedEpisodes);
};

export const deleteWatchedEpisodesOutsideSeasonsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  seasons: SeriesTrackerSeasonMetadataModel[]
): SeriesTrackerWatchedEpisodeModel[] => {
  const itemId = findSeriesTrackerItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return [];

  if (!seasons.length) {
    db.prepare('DELETE FROM series_tracker_watched_episodes WHERE item_id = ?').run(itemId);
    return [];
  }

  const availableEpisodes = new Set<string>();
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      availableEpisodes.add(`${season.season}-${episode}`);
    }
  }

  const watchedEpisodes = findWatchedEpisodesByExternalId(db, usernameHash, externalProvider, externalItemId);
  const prunedEpisodes = watchedEpisodes.filter((episode) =>
    availableEpisodes.has(`${episode.season}-${episode.episode}`)
  );
  if (prunedEpisodes.length === watchedEpisodes.length) return watchedEpisodes;

  return replaceWatchedEpisodesByExternalId(db, usernameHash, externalProvider, externalItemId, prunedEpisodes);
};

export const markAllEpisodesWatched = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  seasons: SeriesTrackerSeasonMetadataModel[]
): SeriesTrackerWatchedEpisodeModel[] => {
  const episodes: SeriesTrackerWatchedEpisodeModel[] = [];
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      episodes.push({ season: season.season, episode });
    }
  }
  return replaceWatchedEpisodes(db, usernameHash, imdbId, episodes);
};

export const markAllEpisodesWatchedByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  seasons: SeriesTrackerSeasonMetadataModel[]
): SeriesTrackerWatchedEpisodeModel[] => {
  const episodes: SeriesTrackerWatchedEpisodeModel[] = [];
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      episodes.push({ season: season.season, episode });
    }
  }
  return replaceWatchedEpisodesByExternalId(db, usernameHash, externalProvider, externalItemId, episodes);
};

export const deleteWatchedEpisodes = (db: Database.Database, usernameHash: string, imdbId: string): void => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_tracker_watched_episodes WHERE item_id = ?').run(itemId);
};

export const deleteWatchedEpisodesByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): void => {
  const itemId = findSeriesTrackerItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_tracker_watched_episodes WHERE item_id = ?').run(itemId);
};
