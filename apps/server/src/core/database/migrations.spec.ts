import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { hasSqlMigrations, runMigrations } from './migrations';

describe('runMigrations', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('only treats directories with SQL migration files as migration directories', () => {
    const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
    tempDirs.push(migrationsDir);

    writeFileSync(join(migrationsDir, '011_add_collection_item_external_ratings.ts'), 'export {};');
    writeFileSync(join(migrationsDir, 'readme.md'), 'not a migration');

    expect(hasSqlMigrations(migrationsDir)).toBe(false);

    writeFileSync(join(migrationsDir, '011_add_collection_item_external_ratings.sql'), 'SELECT 1;');

    expect(hasSqlMigrations(migrationsDir)).toBe(true);
  });

  it('repairs collection item relation foreign keys that point to a renamed table', async () => {
    const db = new Database(':memory:');
    db.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE collection_items_old (id INTEGER PRIMARY KEY AUTOINCREMENT);
      CREATE TABLE collection_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username_hash TEXT NOT NULL,
        imdb_id TEXT NOT NULL,
        list_type TEXT NOT NULL DEFAULT 'library',
        title TEXT NOT NULL,
        title_lower TEXT NOT NULL,
        year TEXT NOT NULL,
        rate TEXT NOT NULL,
        user_rate REAL,
        actors TEXT NOT NULL DEFAULT '',
        plot TEXT NOT NULL,
        image TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE collection_item_genres (
        item_id INTEGER NOT NULL,
        genre TEXT NOT NULL,
        PRIMARY KEY (item_id, genre),
        FOREIGN KEY (item_id) REFERENCES "collection_items_old"(id) ON DELETE CASCADE
      );
      CREATE TABLE collection_item_tags (
        item_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (item_id, tag),
        FOREIGN KEY (item_id) REFERENCES "collection_items_old"(id) ON DELETE CASCADE
      );
      INSERT INTO collection_items (id, username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
      VALUES (1, 'user', 'tt001', 'Title', 'title', '2024', '8.0', 'Plot', 'image', 'hash');
      INSERT INTO collection_item_genres (item_id, genre) VALUES (1, 'Drama');
      INSERT INTO collection_item_tags (item_id, tag) VALUES (1, '#series');
      DROP TABLE collection_items_old;
    `);
    const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
    tempDirs.push(migrationsDir);
    writeFileSync(
      join(migrationsDir, '008_rebuild_collection_item_relation_foreign_keys.sql'),
      `PRAGMA foreign_keys = OFF;
      PRAGMA legacy_alter_table = ON;
      ALTER TABLE collection_item_genres RENAME TO collection_item_genres_old;
      ALTER TABLE collection_item_tags RENAME TO collection_item_tags_old;
      CREATE TABLE collection_item_genres (
        item_id INTEGER NOT NULL,
        genre TEXT NOT NULL,
        PRIMARY KEY (item_id, genre),
        FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
      );
      INSERT INTO collection_item_genres (item_id, genre)
      SELECT item_id, genre FROM collection_item_genres_old
      WHERE EXISTS (SELECT 1 FROM collection_items WHERE collection_items.id = collection_item_genres_old.item_id);
      DROP TABLE collection_item_genres_old;
      CREATE TABLE collection_item_tags (
        item_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (item_id, tag),
        FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
      );
      INSERT INTO collection_item_tags (item_id, tag)
      SELECT item_id, tag FROM collection_item_tags_old
      WHERE EXISTS (SELECT 1 FROM collection_items WHERE collection_items.id = collection_item_tags_old.item_id);
      DROP TABLE collection_item_tags_old;
      PRAGMA foreign_keys = ON;
      PRAGMA legacy_alter_table = OFF;`
    );

    await runMigrations(db, migrationsDir);

    expect(db.prepare('PRAGMA foreign_key_list(collection_item_genres)').all()).toEqual([
      expect.objectContaining({ table: 'collection_items' }),
    ]);
    expect(db.prepare('PRAGMA foreign_key_list(collection_item_tags)').all()).toEqual([
      expect.objectContaining({ table: 'collection_items' }),
    ]);
    expect(db.prepare('SELECT genre FROM collection_item_genres').all()).toEqual([{ genre: 'Drama' }]);
    expect(db.prepare('SELECT tag FROM collection_item_tags').all()).toEqual([{ tag: '#series' }]);
    expect(db.prepare('SELECT id FROM schema_migrations').all()).toEqual([
      { id: '008_rebuild_collection_item_relation_foreign_keys.sql' },
    ]);

    db.close();
  });

  it('normalizes decimal year text artifacts', async () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE collection_items (id INTEGER PRIMARY KEY AUTOINCREMENT, year TEXT NOT NULL);
      INSERT INTO collection_items (year) VALUES ('2005.0'), ('1999'), ('2023-');
    `);
    const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
    tempDirs.push(migrationsDir);
    writeFileSync(
      join(migrationsDir, '009_normalize_decimal_year_text.sql'),
      `UPDATE collection_items
      SET year = SUBSTR(year, 1, 4)
      WHERE year GLOB '[0-9][0-9][0-9][0-9].0';`
    );

    await runMigrations(db, migrationsDir);

    expect(db.prepare('SELECT year FROM collection_items ORDER BY id').all()).toEqual([
      { year: '2005' },
      { year: '1999' },
      { year: '2023-' },
    ]);
    expect(db.prepare('SELECT id FROM schema_migrations').all()).toEqual([
      { id: '009_normalize_decimal_year_text.sql' },
    ]);

    db.close();
  });

  it('preserves the user rate check when adding series tracker list type', async () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE users (username_hash TEXT PRIMARY KEY, user_token_hash TEXT NOT NULL);
      CREATE TABLE collection_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username_hash TEXT NOT NULL,
        imdb_id TEXT NOT NULL,
        list_type TEXT NOT NULL DEFAULT 'library' CHECK (list_type IN ('library', 'watch-later', 'wishlist')),
        title TEXT NOT NULL,
        title_lower TEXT NOT NULL,
        year TEXT NOT NULL,
        rate TEXT NOT NULL,
        user_rate REAL CHECK (user_rate IS NULL OR (user_rate >= 0 AND user_rate <= 10 AND ROUND(user_rate * 10) = user_rate * 10)),
        actors TEXT NOT NULL DEFAULT '',
        plot TEXT NOT NULL,
        image TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username_hash, imdb_id, list_type),
        FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
      );
      CREATE TABLE collection_item_genres (
        item_id INTEGER NOT NULL,
        genre TEXT NOT NULL,
        PRIMARY KEY (item_id, genre),
        FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
      );
      CREATE TABLE collection_item_tags (
        item_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (item_id, tag),
        FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
      );
      INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
      INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash, user_rate)
      VALUES ('user', 'tt001', 'Title', 'title', '2024', '8.0', 'Plot', 'image', 'hash', 9.1);
    `);
    const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
    tempDirs.push(migrationsDir);
    writeFileSync(
      join(migrationsDir, '007_add_series_tracker_list_type.sql'),
      readFileSync(join(process.cwd(), 'apps/server/src/migrations/007_add_series_tracker_list_type.sql'), 'utf8')
    );

    await runMigrations(db, migrationsDir);

    expect(() => {
      db.prepare(
        `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash, user_rate)
         VALUES ('user', 'tt002', 'Invalid', 'invalid', '2024', '8.0', 'Plot', 'image', 'hash2', 8.75)`
      ).run();
    }).toThrow();
    expect(db.prepare('SELECT list_type FROM collection_items WHERE imdb_id = ?').get('tt001')).toEqual({
      list_type: 'library',
    });

    db.close();
  });

  it('adds external rating columns with empty defaults', async () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE users (username_hash TEXT PRIMARY KEY, user_token_hash TEXT NOT NULL);
      CREATE TABLE collection_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username_hash TEXT NOT NULL,
        imdb_id TEXT NOT NULL,
        list_type TEXT NOT NULL DEFAULT 'library' CHECK (list_type IN ('library', 'watch-later', 'wishlist', 'series-tracker')),
        title TEXT NOT NULL,
        title_lower TEXT NOT NULL,
        year TEXT NOT NULL,
        rate TEXT NOT NULL,
        user_rate REAL,
        actors TEXT NOT NULL DEFAULT '',
        plot TEXT NOT NULL,
        image TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username_hash, imdb_id, list_type),
        FOREIGN KEY (username_hash) REFERENCES users(username_hash) ON DELETE CASCADE
      );
      CREATE TABLE collection_item_genres (
        item_id INTEGER NOT NULL,
        genre TEXT NOT NULL,
        PRIMARY KEY (item_id, genre),
        FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
      );
      CREATE TABLE collection_item_tags (
        item_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (item_id, tag),
        FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
      );
      INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
      INSERT INTO collection_items (id, username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
      VALUES (1, 'user', 'tt001', 'Title', 'title', '2024', '8.0', 'Plot', 'image', 'hash');
      INSERT INTO collection_item_genres (item_id, genre) VALUES (1, 'Drama');
      INSERT INTO collection_item_tags (item_id, tag) VALUES (1, '#movie');
    `);
    const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
    tempDirs.push(migrationsDir);
    writeFileSync(
      join(migrationsDir, '011_add_collection_item_external_ratings.sql'),
      readFileSync(
        join(process.cwd(), 'apps/server/src/migrations/011_add_collection_item_external_ratings.sql'),
        'utf8'
      )
    );

    await runMigrations(db, migrationsDir);

    expect(
      db
        .prepare('SELECT rotten_tomatoes_rate, metacritic_rate, content_hash FROM collection_items WHERE imdb_id = ?')
        .get('tt001')
    ).toEqual({
      rotten_tomatoes_rate: '',
      metacritic_rate: '',
      content_hash: 'hash',
    });
    expect(db.prepare('SELECT id FROM schema_migrations ORDER BY id').all()).toEqual([
      { id: '011_add_collection_item_external_ratings.sql' },
    ]);

    db.close();
  });

  it('expands legacy series tracker episode progress tags into watched episodes', async () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE collection_items (id INTEGER PRIMARY KEY AUTOINCREMENT);
      CREATE TABLE collection_item_tags (
        item_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (item_id, tag),
        FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
      );
      CREATE TABLE series_tracker_seasons (
        item_id INTEGER NOT NULL,
        season INTEGER NOT NULL CHECK (season >= 1 AND season <= 50),
        episodes INTEGER NOT NULL CHECK (episodes >= 1 AND episodes <= 100),
        episode_titles TEXT,
        PRIMARY KEY (item_id, season),
        FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
      );
      INSERT INTO collection_items (id) VALUES (1), (2);
      INSERT INTO collection_item_tags (item_id, tag) VALUES (1, '#episode-s02e02'), (2, '#episode-s01e03');
      INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (1, 1, 3), (1, 2, 4);
    `);
    const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
    tempDirs.push(migrationsDir);
    writeFileSync(
      join(migrationsDir, '013_add_series_tracker_watched_episodes.sql'),
      readFileSync(
        join(process.cwd(), 'apps/server/src/migrations/013_add_series_tracker_watched_episodes.sql'),
        'utf8'
      )
    );

    await runMigrations(db, migrationsDir);

    expect(
      db
        .prepare(
          'SELECT item_id, season, episode FROM series_tracker_watched_episodes ORDER BY item_id, season, episode'
        )
        .all()
    ).toEqual([
      { item_id: 1, season: 1, episode: 1 },
      { item_id: 1, season: 1, episode: 2 },
      { item_id: 1, season: 1, episode: 3 },
      { item_id: 1, season: 2, episode: 1 },
      { item_id: 1, season: 2, episode: 2 },
      { item_id: 2, season: 1, episode: 3 },
    ]);
    expect(db.prepare('SELECT tag FROM collection_item_tags ORDER BY item_id').all()).toEqual([]);

    db.close();
  });
});
