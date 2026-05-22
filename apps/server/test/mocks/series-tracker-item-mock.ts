import { getDatabase } from '../../src/core/database/database';

export const insertSeriesTrackerItem = (usernameHash = 'user', imdbId = 'tt-series'): number => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(
    usernameHash,
    `${usernameHash}-token`
  );
  const result = db
    .prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, imdbId, 'series-tracker', 'Series', 'series', '2020', '8.0', '', '', 'hash');
  return Number(result.lastInsertRowid);
};
