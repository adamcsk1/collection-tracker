import { SeriesTrackerSeasonMetadataModel, SeriesTrackerWatchedEpisodeModel } from '@shared/models/api-model';
import Database from 'better-sqlite3';

interface WatchedEpisodeRow {
  season: number;
  episode: number;
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

export const findWatchedEpisodes = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): SeriesTrackerWatchedEpisodeModel[] => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
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

export const deleteWatchedEpisodes = (db: Database.Database, usernameHash: string, imdbId: string): void => {
  const itemId = findSeriesTrackerItemId(db, usernameHash, imdbId);
  if (!itemId) return;
  db.prepare('DELETE FROM series_tracker_watched_episodes WHERE item_id = ?').run(itemId);
};
