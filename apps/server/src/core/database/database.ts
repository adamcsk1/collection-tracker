import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_GLOBAL_KEY = '__collectionTrackerDb';

const getGlobalDb = (): Database.Database | null =>
  (globalThis as Record<string, unknown>)[DB_GLOBAL_KEY] as Database.Database | null;

const setGlobalDb = (db: Database.Database | null): void => {
  (globalThis as Record<string, unknown>)[DB_GLOBAL_KEY] = db;
};

let dbInstance: Database.Database | null = getGlobalDb();

const getDatabasePath = (dataFolder: string): string => `${dataFolder}/database/collection-tracker.sqlite`;

export const initializeDatabase = (dataFolder: string): Database.Database => {
  const existing = getGlobalDb();
  if (existing) return existing;

  const dbPath = getDatabasePath(dataFolder);
  const dbDir = dirname(dbPath);

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  setGlobalDb(dbInstance);

  return dbInstance;
};

export const getDatabase = (): Database.Database => {
  const existing = getGlobalDb();
  if (existing) return existing;

  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return dbInstance;
};
