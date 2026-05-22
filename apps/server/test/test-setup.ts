import { initializeDatabase } from '../src/core/database/database';
import { runMigrations } from '../src/core/database/migrations';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach } from 'vitest';

const tempDir = mkdtempSync(join(tmpdir(), 'collection-tracker-test-'));
const db = initializeDatabase(tempDir);
runMigrations(db, join(__dirname, '..', 'src', 'migrations'));

const tables = [
  'user_shares',
  'collection_item_tags',
  'collection_item_genres',
  'collection_items',
  'access_tokens',
  'refresh_tokens',
  'tag_configs',
  'user_settings',
  'series_tracker_seasons',
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
