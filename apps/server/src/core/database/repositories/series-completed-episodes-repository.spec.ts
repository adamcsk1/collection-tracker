import { beforeEach, describe, expect, it } from 'vitest';
import { getDatabase } from '../database';
import {
  deleteCompletedEpisodes,
  deleteCompletedEpisodesByExternalId,
  deleteCompletedEpisodesOutsideSeasons,
  deleteCompletedEpisodesOutsideSeasonsByExternalId,
  findCompletedEpisodes,
  findCompletedEpisodesByExternalId,
  findLastCompletedEpisode,
  findLastCompletedEpisodeByExternalId,
  markAllEpisodesCompleted,
  markAllEpisodesCompletedByExternalId,
  replaceCompletedEpisodes,
  replaceCompletedEpisodesByExternalId,
} from './series-completed-episodes-repository';

const usernameHash = 'series-user';
const imdbId = 'tt1234567';

const insertTrackingSeries = (): void => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
  db.prepare(
    `INSERT INTO collection_items
     (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower,
      year, contributors, description, image, content_hash, content_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    usernameHash,
    'imdb',
    imdbId,
    `imdb:${imdbId}`,
    'tracking',
    'Series',
    'series',
    '2026',
    '',
    '',
    '',
    'series-hash',
    'series'
  );
  db.prepare(
    `INSERT INTO external_item_identities
     (username_hash, external_provider, external_item_id, canonical_item_id, source_confidence)
     VALUES (?, ?, ?, ?, ?)`
  ).run(usernameHash, 'omdb', imdbId, `imdb:${imdbId}`, 'alias');
};

describe('series-completed-episodes-repository', () => {
  beforeEach(() => {
    insertTrackingSeries();
  });

  it('stores, finds, completes, prunes, and deletes completed episodes through IMDb identity', () => {
    const db = getDatabase();

    expect(
      replaceCompletedEpisodes(db, usernameHash, imdbId, [
        { season: 1, episode: 1 },
        { season: 2, episode: 1 },
      ])
    ).toHaveLength(2);
    expect(findLastCompletedEpisode(db, usernameHash, imdbId)).toEqual({ season: 2, episode: 1 });
    expect(
      deleteCompletedEpisodesOutsideSeasons(db, usernameHash, imdbId, [
        { season: 1, episodes: 1 },
        { season: 2, episodes: 1 },
      ])
    ).toHaveLength(2);
    expect(deleteCompletedEpisodesOutsideSeasons(db, usernameHash, imdbId, [{ season: 1, episodes: 1 }])).toEqual([
      { season: 1, episode: 1 },
    ]);
    expect(markAllEpisodesCompleted(db, usernameHash, imdbId, [{ season: 1, episodes: 2 }])).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);

    deleteCompletedEpisodes(db, usernameHash, imdbId);

    expect(findCompletedEpisodes(db, usernameHash, imdbId)).toEqual([]);
    expect(findLastCompletedEpisode(db, usernameHash, imdbId)).toBeNull();
  });

  it('supports completed episode operations through canonical aliases', () => {
    const db = getDatabase();

    expect(replaceCompletedEpisodesByExternalId(db, usernameHash, 'omdb', imdbId, [{ season: 1, episode: 1 }])).toEqual(
      [{ season: 1, episode: 1 }]
    );
    expect(findCompletedEpisodesByExternalId(db, usernameHash, 'omdb', imdbId)).toHaveLength(1);
    expect(findLastCompletedEpisodeByExternalId(db, usernameHash, 'omdb', imdbId)).toEqual({ season: 1, episode: 1 });
    expect(
      markAllEpisodesCompletedByExternalId(db, usernameHash, 'omdb', imdbId, [{ season: 4, episodes: 2 }])
    ).toHaveLength(2);
    expect(
      deleteCompletedEpisodesOutsideSeasonsByExternalId(db, usernameHash, 'omdb', imdbId, [{ season: 4, episodes: 1 }])
    ).toEqual([{ season: 4, episode: 1 }]);
    expect(deleteCompletedEpisodesOutsideSeasonsByExternalId(db, usernameHash, 'omdb', imdbId, [])).toEqual([]);

    deleteCompletedEpisodesByExternalId(db, usernameHash, 'omdb', imdbId);

    expect(findCompletedEpisodesByExternalId(db, usernameHash, 'omdb', imdbId)).toEqual([]);
    expect(findLastCompletedEpisodeByExternalId(db, usernameHash, 'omdb', imdbId)).toBeNull();
  });

  it('returns empty results and no-ops when tracking identities do not exist', () => {
    const db = getDatabase();

    expect(findCompletedEpisodes(db, usernameHash, 'missing')).toEqual([]);
    expect(findCompletedEpisodesByExternalId(db, usernameHash, 'omdb', 'tt9999999')).toEqual([]);
    expect(findLastCompletedEpisode(db, usernameHash, 'missing')).toBeNull();
    expect(findLastCompletedEpisodeByExternalId(db, usernameHash, 'omdb', 'tt9999999')).toBeNull();
    expect(replaceCompletedEpisodes(db, usernameHash, 'missing', [])).toEqual([]);
    expect(replaceCompletedEpisodesByExternalId(db, usernameHash, 'omdb', 'tt9999999', [])).toEqual([]);
    expect(deleteCompletedEpisodesOutsideSeasons(db, usernameHash, 'missing', [])).toEqual([]);
    expect(deleteCompletedEpisodesOutsideSeasonsByExternalId(db, usernameHash, 'omdb', 'tt9999999', [])).toEqual([]);

    deleteCompletedEpisodes(db, usernameHash, 'missing');
    deleteCompletedEpisodesByExternalId(db, usernameHash, 'omdb', 'tt9999999');
  });
});
