import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATTERN = /^\d+_.+\.sql$/;

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
