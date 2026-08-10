import { beforeEach, describe, expect, it } from 'vitest';
import { getDatabase } from '../database';
import {
  deleteTrackingSeasons,
  deleteTrackingSeasonsByExternalId,
  findTrackingSeasons,
  findTrackingSeasonsByExternalId,
  replaceTrackingSeasons,
  replaceTrackingSeasonsByExternalId,
} from './tracking-season-repository';

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

describe('tracking-season-repository', () => {
  beforeEach(() => {
    insertTrackingSeries();
  });

  it('stores, reads, and deletes season metadata through IMDb identity', () => {
    const db = getDatabase();

    expect(
      replaceTrackingSeasons(db, usernameHash, imdbId, [
        { season: 1, episodes: 2, titles: ['Pilot', 'Finale'] },
        { season: 2, episodes: 1 },
      ])
    ).toEqual([
      { season: 1, episodes: 2, titles: ['Pilot', 'Finale'] },
      { season: 2, episodes: 1, titles: [] },
    ]);
    expect(findTrackingSeasons(db, usernameHash, imdbId)).toHaveLength(2);

    deleteTrackingSeasons(db, usernameHash, imdbId);

    expect(findTrackingSeasons(db, usernameHash, imdbId)).toEqual([]);
  });

  it('resolves canonical aliases for season metadata operations', () => {
    const db = getDatabase();

    expect(replaceTrackingSeasonsByExternalId(db, usernameHash, 'omdb', imdbId, [{ season: 3, episodes: 1 }])).toEqual([
      { season: 3, episodes: 1, titles: [] },
    ]);
    expect(findTrackingSeasonsByExternalId(db, usernameHash, 'omdb', imdbId)).toHaveLength(1);

    deleteTrackingSeasonsByExternalId(db, usernameHash, 'omdb', imdbId);

    expect(findTrackingSeasonsByExternalId(db, usernameHash, 'omdb', imdbId)).toEqual([]);
  });

  it('returns empty results and no-ops when tracking identities do not exist', () => {
    const db = getDatabase();

    expect(findTrackingSeasons(db, usernameHash, 'missing')).toEqual([]);
    expect(findTrackingSeasonsByExternalId(db, usernameHash, 'omdb', 'tt9999999')).toEqual([]);
    expect(replaceTrackingSeasons(db, usernameHash, 'missing', [])).toEqual([]);
    expect(replaceTrackingSeasonsByExternalId(db, usernameHash, 'omdb', 'tt9999999', [])).toEqual([]);

    deleteTrackingSeasons(db, usernameHash, 'missing');
    deleteTrackingSeasonsByExternalId(db, usernameHash, 'omdb', 'tt9999999');
  });
});
