import { initializeDatabase } from '../src/core/database/database';
import { runMigrations } from '../src/core/database/migrations';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach } from 'vitest';

const tempDir = mkdtempSync(join(tmpdir(), 'collection-tracker-test-'));
const db = initializeDatabase(tempDir);
await runMigrations(db, join(__dirname, '..', 'src', 'migrations'));

const tables = [
  'user_shares',
  'ai_search_embeddings',
  'collection_item_external_ratings',
  'collection_item_tracker_state',
  'collection_item_tags',
  'collection_item_genres',
  'external_item_identities',
  'collection_items',
  'access_tokens',
  'refresh_tokens',
  'tag_configs',
  'user_settings',
  'series_tracker_seasons',
  'series_completed_episodes',
  'users',
];

beforeEach(() => {
  for (const table of tables) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch {
      // Table might not exist yet
    }
  }
});
