import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { getItemHash } from '../utils/collection-item-util';

const MIGRATION_PATTERN = /^\d+_.+\.sql$/;

const recomputeCollectionItemHashes = (db: Database.Database): void => {
  const tableExists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'collection_items'")
    .get();
  if (!tableExists) return;

  const rows = db.prepare('SELECT * FROM collection_items').all() as Array<{
    id: number;
    imdb_id: string;
    title: string;
    year: string;
    rate: string;
    rotten_tomatoes_rate: string | null;
    metacritic_rate: string | null;
    user_rate: number | null;
    actors: string;
    plot: string;
    image: string;
    content_type?: 'movie' | 'series';
    favorite?: 0 | 1;
  }>;

  const genresByItem = db.prepare('SELECT genre FROM collection_item_genres WHERE item_id = ? ORDER BY genre');
  const tagsByItem = db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag');
  const updateHash = db.prepare('UPDATE collection_items SET content_hash = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    for (const row of rows) {
      const genre = (genresByItem.all(row.id) as Array<{ genre: string }>).map((genreRow) => genreRow.genre);
      const tags = (tagsByItem.all(row.id) as Array<{ tag: string }>).map((tagRow) => tagRow.tag);
      updateHash.run(
        getItemHash({
          image: row.image,
          title: row.title,
          genre,
          IMDbId: row.imdb_id,
          tags,
          year: row.year || null,
          rate: row.rate,
          rottenTomatoesRate: row.rotten_tomatoes_rate ?? '',
          metacriticRate: row.metacritic_rate ?? '',
          userRate: row.user_rate,
          actors: row.actors,
          plot: row.plot,
          contentType: row.content_type ?? 'movie',
          favorite: row.favorite === 1,
        }),
        row.id
      );
    }
  });
  transaction();
};

export const hasSqlMigrations = (migrationsDir: string): boolean =>
  readdirSync(migrationsDir).some((file) => MIGRATION_PATTERN.test(file));

export const runMigrations = async (db: Database.Database, migrationsDir: string): Promise<void> => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedRows = db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>;
  const appliedIds = new Set(appliedRows.map((row) => row.id));

  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => MIGRATION_PATTERN.test(file))
    .sort();

  for (const file of migrationFiles) {
    if (appliedIds.has(file)) {
      continue;
    }

    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    try {
      db.exec(sql);
      if (file === '015_add_movie_tracker_list_type.sql' || file === '017_move_system_tags_to_columns.sql') {
        recomputeCollectionItemHashes(db);
      }
      db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(file);
      appliedIds.add(file);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Migration failed: ${file} - ${error.message}`);
      }
      throw error;
    }
  }
};
