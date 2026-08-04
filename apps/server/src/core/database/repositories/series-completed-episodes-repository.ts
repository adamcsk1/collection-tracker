import { TrackingSeasonMetadataModel, TrackingCompletedEpisodeModel } from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { resolveCanonicalItemId } from './external-item-identity-repository';
import { CompletedEpisodeRow } from './series-completed-episodes-model';

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

const findCompletedEpisodesByItemId = (
  db: Database.Database,
  itemId: number | null
): TrackingCompletedEpisodeModel[] => {
  if (!itemId) return [];
  return (
    db
      .prepare(
        `SELECT season, episode
         FROM series_completed_episodes
         WHERE item_id = ?
         ORDER BY season, episode`
      )
      .all(itemId) as CompletedEpisodeRow[]
  ).map((row) => ({ season: row.season, episode: row.episode }));
};

export const findCompletedEpisodes = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): TrackingCompletedEpisodeModel[] => {
  const itemId = findTrackingItemId(db, usernameHash, imdbId);
  return findCompletedEpisodesByItemId(db, itemId);
};

export const findCompletedEpisodesByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): TrackingCompletedEpisodeModel[] => {
  const itemId = findTrackingItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  return findCompletedEpisodesByItemId(db, itemId);
};

export const findLastCompletedEpisode = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): { season: number; episode: number } | null => {
  const itemId = findTrackingItemId(db, usernameHash, imdbId);
  if (!itemId) return null;
  const row = db
    .prepare(
      `SELECT season, episode
       FROM series_completed_episodes
       WHERE item_id = ?
       ORDER BY season DESC, episode DESC
       LIMIT 1`
    )
    .get(itemId) as CompletedEpisodeRow | undefined;
  return row ? { season: row.season, episode: row.episode } : null;
};

export const findLastCompletedEpisodeByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): { season: number; episode: number } | null => {
  const itemId = findTrackingItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return null;
  const row = db
    .prepare(
      `SELECT season, episode
       FROM series_completed_episodes
       WHERE item_id = ?
       ORDER BY season DESC, episode DESC
       LIMIT 1`
    )
    .get(itemId) as CompletedEpisodeRow | undefined;
  return row ? { season: row.season, episode: row.episode } : null;
};

export const replaceCompletedEpisodes = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  episodes: TrackingCompletedEpisodeModel[]
): TrackingCompletedEpisodeModel[] => {
  const itemId = findTrackingItemId(db, usernameHash, imdbId);
  if (!itemId) return [];

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM series_completed_episodes WHERE item_id = ?').run(itemId);

    const insert = db.prepare(
      `INSERT INTO series_completed_episodes (item_id, season, episode)
       VALUES (?, ?, ?)`
    );
    for (const episode of episodes) {
      insert.run(itemId, episode.season, episode.episode);
    }
  });

  transaction();
  return findCompletedEpisodes(db, usernameHash, imdbId);
};

export const replaceCompletedEpisodesByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  episodes: TrackingCompletedEpisodeModel[]
): TrackingCompletedEpisodeModel[] => {
  const itemId = findTrackingItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return [];

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM series_completed_episodes WHERE item_id = ?').run(itemId);

    const insert = db.prepare(
      `INSERT INTO series_completed_episodes (item_id, season, episode)
       VALUES (?, ?, ?)`
    );
    for (const episode of episodes) {
      insert.run(itemId, episode.season, episode.episode);
    }
  });

  transaction();
  return findCompletedEpisodesByExternalId(db, usernameHash, externalProvider, externalItemId);
};

export const deleteCompletedEpisodesOutsideSeasons = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  seasons: TrackingSeasonMetadataModel[]
): TrackingCompletedEpisodeModel[] => {
  const itemId = findTrackingItemId(db, usernameHash, imdbId);
  if (!itemId) return [];

  if (!seasons.length) {
    db.prepare('DELETE FROM series_completed_episodes WHERE item_id = ?').run(itemId);
    return [];
  }

  const availableEpisodes = new Set<string>();
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      availableEpisodes.add(`${season.season}-${episode}`);
    }
  }

  const completedEpisodes = findCompletedEpisodes(db, usernameHash, imdbId);
  const prunedEpisodes = completedEpisodes.filter((episode) =>
    availableEpisodes.has(`${episode.season}-${episode.episode}`)
  );
  if (prunedEpisodes.length === completedEpisodes.length) return completedEpisodes;

  return replaceCompletedEpisodes(db, usernameHash, imdbId, prunedEpisodes);
};

export const deleteCompletedEpisodesOutsideSeasonsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  seasons: TrackingSeasonMetadataModel[]
): TrackingCompletedEpisodeModel[] => {
  const itemId = findTrackingItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return [];

  if (!seasons.length) {
    db.prepare('DELETE FROM series_completed_episodes WHERE item_id = ?').run(itemId);
    return [];
  }

  const availableEpisodes = new Set<string>();
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      availableEpisodes.add(`${season.season}-${episode}`);
    }
  }

  const completedEpisodes = findCompletedEpisodesByExternalId(db, usernameHash, externalProvider, externalItemId);
  const prunedEpisodes = completedEpisodes.filter((episode) =>
    availableEpisodes.has(`${episode.season}-${episode.episode}`)
  );
  if (prunedEpisodes.length === completedEpisodes.length) return completedEpisodes;

  return replaceCompletedEpisodesByExternalId(db, usernameHash, externalProvider, externalItemId, prunedEpisodes);
};

export const markAllEpisodesCompleted = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  seasons: TrackingSeasonMetadataModel[]
): TrackingCompletedEpisodeModel[] => {
  const episodes: TrackingCompletedEpisodeModel[] = [];
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      episodes.push({ season: season.season, episode });
    }
  }
  return replaceCompletedEpisodes(db, usernameHash, imdbId, episodes);
};

export const markAllEpisodesCompletedByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  seasons: TrackingSeasonMetadataModel[]
): TrackingCompletedEpisodeModel[] => {
  const episodes: TrackingCompletedEpisodeModel[] = [];
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      episodes.push({ season: season.season, episode });
    }
  }
  return replaceCompletedEpisodesByExternalId(db, usernameHash, externalProvider, externalItemId, episodes);
};

export const deleteCompletedEpisodes = (db: Database.Database, usernameHash: string, imdbId: string): void => {
  const itemId = findTrackingItemId(db, usernameHash, imdbId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_completed_episodes WHERE item_id = ?').run(itemId);
};

export const deleteCompletedEpisodesByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): void => {
  const itemId = findTrackingItemIdByExternalId(db, usernameHash, externalProvider, externalItemId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_completed_episodes WHERE item_id = ?').run(itemId);
};
