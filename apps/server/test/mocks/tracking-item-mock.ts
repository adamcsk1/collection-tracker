import { getDatabase } from '../../src/core/database/database';

export const insertTrackingItem = (usernameHash = 'user', imdbId = 'tt-series'): number => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(
    usernameHash,
    `${usernameHash}-token`
  );
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, contributors, description, image, content_hash, content_type)
       VALUES (?, 'omdb', ?, ?, 'tracking', 'Series', 'series', '2020', '', '', '', 'hash', 'series')`
    )
    .run(usernameHash, imdbId, `imdb:${imdbId}`);
  const itemId = Number(result.lastInsertRowid);
  db.prepare(
    `INSERT INTO external_item_identities
      (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
     VALUES (?, ?, 'omdb', ?, 'primary'), (?, ?, 'imdb', ?, 'alias')`
  ).run(usernameHash, `imdb:${imdbId}`, imdbId, usernameHash, `imdb:${imdbId}`, imdbId);
  db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, NULL)').run(itemId);
  return itemId;
};
