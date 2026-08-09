import Database from 'better-sqlite3';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getItemHash } from '../utils/collection-item-util';
import { hasSqlMigrations, runMigrations } from './migrations';

const MIGRATIONS_SRC_DIR = join(__dirname, '..', '..', 'migrations');

const preparePreMigrationState = async (
  targetFile: string,
  tempDirs: string[]
): Promise<{ db: Database.Database; migrationsDir: string }> => {
  const db = new Database(':memory:');
  const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
  tempDirs.push(migrationsDir);

  const files = readdirSync(MIGRATIONS_SRC_DIR)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    if (file >= targetFile) break;
    copyFileSync(join(MIGRATIONS_SRC_DIR, file), join(migrationsDir, file));
  }

  await runMigrations(db, migrationsDir);
  return { db, migrationsDir };
};

const preparePre034ShareState = async (
  tempDirs: string[]
): Promise<{ db: Database.Database; migrationsDir: string }> => {
  const state = await preparePreMigrationState('034_share_grants_by_list_and_content.sql', tempDirs);
  state.db.exec(`
    INSERT INTO users (username_hash, user_token_hash, username) VALUES
       ('owner', 'owner-token', 'Owner'),
       ('reader', 'reader-token', 'Reader'),
       ('editor', 'editor-token', 'Editor'),
       ('disabled', 'disabled-token', 'Disabled');
    INSERT INTO user_shares
      (id, owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete, created_at)
    VALUES
      (10, 'owner', 'reader', 1, 0, 0, 0, '2026-01-01 00:00:00'),
      (20, 'owner', 'editor', 1, 1, 1, 0, '2026-02-01 00:00:00'),
      (30, 'owner', 'disabled', 0, 0, 0, 0, '2026-03-01 00:00:00');
  `);
  return state;
};

describe('runMigrations', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
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

  describe('001_initial_schema', () => {
    it('creates the initial schema with all tables, indexes, and foreign keys', async () => {
      const db = new Database(':memory:');
      const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
      tempDirs.push(migrationsDir);
      copyFileSync(join(MIGRATIONS_SRC_DIR, '001_initial_schema.sql'), join(migrationsDir, '001_initial_schema.sql'));

      await runMigrations(db, migrationsDir);

      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user1', 'tok1');
        INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent)
          VALUES ('user1', 'hash1', '2024-01-01T00:00:00Z', 'Mozilla/5.0');
        INSERT INTO refresh_tokens (username_hash, token_hash, created_at, user_agent)
          VALUES ('user1', 'hash2', '2024-01-01T00:00:00Z', 'Mozilla/5.0');
        INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, actors, image, content_hash)
          VALUES ('user1', 'tt0111161', 'The Shawshank Redemption', 'the shawshank redemption', '1994', '9.3',
                  'Two imprisoned men bond over a number of years...', 'Tim Robbins, Morgan Freeman', 'img1', 'hash1');
        INSERT INTO collection_item_genres (item_id, genre) VALUES (1, 'Drama');
        INSERT INTO collection_item_tags (item_id, tag) VALUES (1, '#movie'), (1, 'custom-tag');
        INSERT INTO user_settings (username_hash, theme, animated_background, language)
          VALUES ('user1', 'dark', 1, 'en');
        INSERT INTO tag_configs (username_hash, tag, color, use_for_image_border, use_for_text_color, use_for_image_badge, weight)
          VALUES ('user1', '#movie', '#ff0000', 1, 0, 1, 10);
      `);

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
        name: string;
      }>;
      expect(tables.map((t) => t.name).filter((name) => name !== 'sqlite_sequence')).toEqual([
        'access_tokens',
        'collection_item_genres',
        'collection_item_tags',
        'collection_items',
        'refresh_tokens',
        'schema_migrations',
        'tag_configs',
        'user_settings',
        'users',
      ]);

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name")
        .all() as Array<{ name: string }>;
      expect(indexes.map((i) => i.name)).toEqual([
        'idx_access_tokens_username',
        'idx_collection_item_genres_item',
        'idx_collection_item_tags_item',
        'idx_collection_items_created',
        'idx_collection_items_username',
        'idx_refresh_tokens_username',
        'idx_tag_configs_username',
      ]);

      const fks = db.prepare('PRAGMA foreign_key_list(collection_items)').all() as Array<{
        table: string;
        from: string;
        to: string;
        on_delete: string;
      }>;
      expect(fks).toEqual([
        expect.objectContaining({
          table: 'users',
          from: 'username_hash',
          to: 'username_hash',
          on_delete: 'CASCADE',
        }),
      ]);

      expect(db.prepare('SELECT id FROM schema_migrations').all()).toEqual([{ id: '001_initial_schema.sql' }]);

      db.close();
    });
  });

  describe('002_add_sharing', () => {
    it('creates user_shares table with indexes and cascade foreign keys', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('002_add_sharing.sql', tempDirs);
      copyFileSync(join(MIGRATIONS_SRC_DIR, '002_add_sharing.sql'), join(migrationsDir, '002_add_sharing.sql'));

      await runMigrations(db, migrationsDir);

      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('owner', 'tok1'), ('shared', 'tok2');
        INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
          VALUES ('owner', 'shared', 1, 0, 1, 0);
      `);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_shares'")
        .all() as Array<{ name: string }>;
      expect(tables).toHaveLength(1);

      const fks = db.prepare('PRAGMA foreign_key_list(user_shares)').all() as Array<{
        table: string;
        from: string;
        to: string;
        on_delete: string;
      }>;
      expect(fks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table: 'users',
            from: 'owner_username_hash',
            to: 'username_hash',
            on_delete: 'CASCADE',
          }),
          expect.objectContaining({
            table: 'users',
            from: 'shared_with_username_hash',
            to: 'username_hash',
            on_delete: 'CASCADE',
          }),
        ])
      );

      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'user_shares' AND sql IS NOT NULL ORDER BY name"
        )
        .all() as Array<{ name: string }>;
      expect(indexes.map((i) => i.name)).toEqual(['idx_user_shares_owner', 'idx_user_shares_shared_with']);

      db.prepare("DELETE FROM users WHERE username_hash = 'owner'").run();
      expect(db.prepare('SELECT * FROM user_shares').all()).toHaveLength(0);

      db.close();
    });
  });

  describe('003_add_user_display_names', () => {
    it('adds nullable username display name column', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('003_add_user_display_names.sql', tempDirs);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '003_add_user_display_names.sql'),
        join(migrationsDir, '003_add_user_display_names.sql')
      );

      await runMigrations(db, migrationsDir);

      db.exec(`INSERT INTO users (username_hash, user_token_hash, username) VALUES ('user1', 'tok1', 'Alice');`);

      const cols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
      expect(cols.map((c) => c.name)).toContain('username');

      const user = db.prepare('SELECT username FROM users WHERE username_hash = ?').get('user1') as {
        username: string | null;
      };
      expect(user.username).toBe('Alice');

      db.prepare("UPDATE users SET username = NULL WHERE username_hash = 'user1'").run();
      const updated = db.prepare('SELECT username FROM users WHERE username_hash = ?').get('user1') as {
        username: string | null;
      };
      expect(updated.username).toBeNull();

      db.close();
    });
  });

  describe('004_add_collection_item_list_type', () => {
    it('converts watch-later and wishlist tags into list_type values and preserves tags', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('004_add_collection_item_list_type.sql', tempDirs);

      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user1', 'tok1');
        INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, actors, image, content_hash)
          VALUES ('user1', 'tt001', 'Movie A', 'movie a', '2020', '8.0', 'Plot A', 'Actor A', 'img1', 'hash1'),
                 ('user1', 'tt002', 'Movie B', 'movie b', '2021', '7.5', 'Plot B', 'Actor B', 'img2', 'hash2'),
                 ('user1', 'tt003', 'Movie C', 'movie c', '2022', '9.0', 'Plot C', 'Actor C', 'img3', 'hash3');
        INSERT INTO collection_item_genres (item_id, genre) VALUES (1, 'Drama'), (2, 'Action'), (3, 'Comedy');
        INSERT INTO collection_item_tags (item_id, tag) VALUES
          (1, '#watch-later'), (1, '#favorite'), (1, 'custom'),
          (2, '#wishlist'), (2, 'tag2'),
          (3, 'tag3');
      `);

      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '004_add_collection_item_list_type.sql'),
        join(migrationsDir, '004_add_collection_item_list_type.sql')
      );
      await runMigrations(db, migrationsDir);

      expect(db.prepare('SELECT list_type FROM collection_items WHERE imdb_id = ?').get('tt001')).toEqual({
        list_type: 'watch-later',
      });
      expect(db.prepare('SELECT list_type FROM collection_items WHERE imdb_id = ?').get('tt002')).toEqual({
        list_type: 'wishlist',
      });
      expect(db.prepare('SELECT list_type FROM collection_items WHERE imdb_id = ?').get('tt003')).toEqual({
        list_type: 'library',
      });

      const tags1 = db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag').all(1) as Array<{
        tag: string;
      }>;
      expect(tags1.map((t) => t.tag)).toEqual(['#favorite', '#watch-later', 'custom']);

      const tags2 = db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag').all(2) as Array<{
        tag: string;
      }>;
      expect(tags2.map((t) => t.tag)).toEqual(['#wishlist', 'tag2']);

      const tags3 = db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag').all(3) as Array<{
        tag: string;
      }>;
      expect(tags3.map((t) => t.tag)).toEqual(['tag3']);

      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'collection_items' AND sql IS NOT NULL ORDER BY name"
        )
        .all() as Array<{ name: string }>;
      expect(indexes.map((i) => i.name)).toContain('idx_collection_items_list_type');

      db.close();
    });
  });

  describe('005_add_collection_item_user_rate', () => {
    it('adds user_rate column with one-decimal CHECK constraint', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('005_add_collection_item_user_rate.sql', tempDirs);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '005_add_collection_item_user_rate.sql'),
        join(migrationsDir, '005_add_collection_item_user_rate.sql')
      );

      await runMigrations(db, migrationsDir);

      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user1', 'tok1');
        INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, actors, image, content_hash, list_type)
          VALUES ('user1', 'tt001', 'Movie', 'movie', '2020', '8.0', 'Plot', 'Actor', 'img', 'hash', 'library');
      `);

      db.prepare('UPDATE collection_items SET user_rate = ? WHERE imdb_id = ?').run(null, 'tt001');
      db.prepare('UPDATE collection_items SET user_rate = ? WHERE imdb_id = ?').run(0, 'tt001');
      db.prepare('UPDATE collection_items SET user_rate = ? WHERE imdb_id = ?').run(8.5, 'tt001');
      db.prepare('UPDATE collection_items SET user_rate = ? WHERE imdb_id = ?').run(10, 'tt001');

      expect(() =>
        db.prepare('UPDATE collection_items SET user_rate = ? WHERE imdb_id = ?').run(8.75, 'tt001')
      ).toThrow();
      expect(() =>
        db.prepare('UPDATE collection_items SET user_rate = ? WHERE imdb_id = ?').run(-1, 'tt001')
      ).toThrow();
      expect(() =>
        db.prepare('UPDATE collection_items SET user_rate = ? WHERE imdb_id = ?').run(11, 'tt001')
      ).toThrow();

      db.close();
    });
  });

  describe('006_add_default_library_setting', () => {
    it('adds default_library_owner_share_code column to user_settings', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('006_add_default_library_setting.sql', tempDirs);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '006_add_default_library_setting.sql'),
        join(migrationsDir, '006_add_default_library_setting.sql')
      );

      await runMigrations(db, migrationsDir);

      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user1', 'tok1');
        INSERT INTO user_settings (username_hash) VALUES ('user1');
      `);

      const cols = db.prepare('PRAGMA table_info(user_settings)').all() as Array<{ name: string }>;
      expect(cols.map((c) => c.name)).toContain('default_library_owner_share_code');

      db.prepare(
        "UPDATE user_settings SET default_library_owner_share_code = 'share-abc' WHERE username_hash = 'user1'"
      ).run();
      const setting = db
        .prepare('SELECT default_library_owner_share_code FROM user_settings WHERE username_hash = ?')
        .get('user1') as { default_library_owner_share_code: string | null };
      expect(setting.default_library_owner_share_code).toBe('share-abc');

      db.close();
    });
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

  describe('010_add_series_tracker_seasons', () => {
    it('creates series_tracker_seasons table with CHECK constraints, FK cascade, and index', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('010_add_series_tracker_seasons.sql', tempDirs);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '010_add_series_tracker_seasons.sql'),
        join(migrationsDir, '010_add_series_tracker_seasons.sql')
      );

      await runMigrations(db, migrationsDir);

      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user1', 'tok1');
        INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, actors, image, content_hash, list_type)
          VALUES ('user1', 'tt001', 'Series', 'series', '2020', '8.0', 'Plot', 'Actor', 'img', 'hash', 'series-tracker');
      `);

      db.prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(1, 1, 10);
      db.prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(1, 2, 12);

      expect(() =>
        db.prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(1, 0, 10)
      ).toThrow();
      expect(() =>
        db.prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(1, 51, 10)
      ).toThrow();
      expect(() =>
        db.prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(1, 1, 0)
      ).toThrow();
      expect(() =>
        db.prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(1, 1, 101)
      ).toThrow();

      db.prepare('DELETE FROM collection_items WHERE id = 1').run();
      expect(db.prepare('SELECT * FROM series_tracker_seasons').all()).toHaveLength(0);

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'series_tracker_seasons'")
        .all() as Array<{ name: string }>;
      expect(indexes.map((i) => i.name)).toContain('idx_series_tracker_seasons_item');

      db.close();
    });
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

  describe('011_add_series_tracker_episode_titles', () => {
    it('adds nullable episode_titles column to series_tracker_seasons', async () => {
      const { db, migrationsDir } = await preparePreMigrationState(
        '011_add_series_tracker_episode_titles.sql',
        tempDirs
      );
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '011_add_series_tracker_episode_titles.sql'),
        join(migrationsDir, '011_add_series_tracker_episode_titles.sql')
      );

      await runMigrations(db, migrationsDir);

      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user1', 'tok1');
        INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, actors, image, content_hash, list_type)
          VALUES ('user1', 'tt001', 'Series', 'series', '2020', '8.0', 'Plot', 'Actor', 'img', 'hash', 'series-tracker');
        INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (1, 1, 3);
      `);

      const cols = db.prepare('PRAGMA table_info(series_tracker_seasons)').all() as Array<{ name: string }>;
      expect(cols.map((c) => c.name)).toContain('episode_titles');

      db.prepare('UPDATE series_tracker_seasons SET episode_titles = ? WHERE item_id = 1 AND season = 1').run(
        '["Pilot","Episode 2","Finale"]'
      );
      const row = db
        .prepare('SELECT episode_titles FROM series_tracker_seasons WHERE item_id = 1 AND season = 1')
        .get() as { episode_titles: string | null };
      expect(row.episode_titles).toBe('["Pilot","Episode 2","Finale"]');

      db.close();
    });
  });

  describe('012_add_collection_list_display_preferences', () => {
    it('adds collection_list_display_preferences column to user_settings', async () => {
      const { db, migrationsDir } = await preparePreMigrationState(
        '012_add_collection_list_display_preferences.sql',
        tempDirs
      );
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '012_add_collection_list_display_preferences.sql'),
        join(migrationsDir, '012_add_collection_list_display_preferences.sql')
      );

      await runMigrations(db, migrationsDir);

      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user1', 'tok1');
        INSERT INTO user_settings (username_hash) VALUES ('user1');
      `);

      const cols = db.prepare('PRAGMA table_info(user_settings)').all() as Array<{ name: string }>;
      expect(cols.map((c) => c.name)).toContain('collection_list_display_preferences');

      db.prepare(
        "UPDATE user_settings SET collection_list_display_preferences = '{\"compact\":true}' WHERE username_hash = 'user1'"
      ).run();
      const setting = db
        .prepare('SELECT collection_list_display_preferences FROM user_settings WHERE username_hash = ?')
        .get('user1') as { collection_list_display_preferences: string | null };
      expect(setting.collection_list_display_preferences).toBe('{"compact":true}');

      db.close();
    });
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
    expect(db.prepare('SELECT item_id, tag FROM collection_item_tags ORDER BY item_id').all()).toEqual([
      { item_id: 1, tag: '#episode-s02e02' },
      { item_id: 2, tag: '#episode-s01e03' },
    ]);

    db.close();
  });

  describe('014_add_ai_search_embeddings', () => {
    it('creates ai_search_embeddings table with composite PK, FK cascade, and index', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('014_add_ai_search_embeddings.sql', tempDirs);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '014_add_ai_search_embeddings.sql'),
        join(migrationsDir, '014_add_ai_search_embeddings.sql')
      );

      await runMigrations(db, migrationsDir);

      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user1', 'tok1');
        INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, actors, image, content_hash, list_type)
          VALUES ('user1', 'tt001', 'Movie', 'movie', '2020', '8.0', 'Plot', 'Actor', 'img', 'hash', 'library');
      `);

      db.prepare(
        `
        INSERT INTO ai_search_embeddings (item_id, embedding_model, content_hash, embedding_json)
        VALUES (?, ?, ?, ?)
      `
      ).run(1, 'mxbai-embed-large', 'hash1', '[0.1,0.2,0.3]');

      expect(() =>
        db
          .prepare(
            `
          INSERT INTO ai_search_embeddings (item_id, embedding_model, content_hash, embedding_json)
          VALUES (?, ?, ?, ?)
        `
          )
          .run(1, 'mxbai-embed-large', 'hash2', '[0.4,0.5,0.6]')
      ).toThrow();

      db.prepare(
        `
        INSERT INTO ai_search_embeddings (item_id, embedding_model, content_hash, embedding_json)
        VALUES (?, ?, ?, ?)
      `
      ).run(1, 'other-model', 'hash2', '[0.4,0.5,0.6]');

      db.prepare('DELETE FROM collection_items WHERE id = 1').run();
      expect(db.prepare('SELECT * FROM ai_search_embeddings').all()).toHaveLength(0);

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ai_search_embeddings'")
        .all() as Array<{ name: string }>;
      expect(indexes.map((i) => i.name)).toContain('idx_ai_search_embeddings_item');

      db.close();
    });
  });

  it('moves legacy watched movies into sanitized movie tracker rows with current hashes', async () => {
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
        user_rate REAL CHECK (user_rate IS NULL OR (user_rate >= 0 AND user_rate <= 10 AND ROUND(user_rate * 10) = user_rate * 10)),
        actors TEXT NOT NULL DEFAULT '',
        plot TEXT NOT NULL,
        image TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        rotten_tomatoes_rate TEXT NOT NULL DEFAULT '',
        metacritic_rate TEXT NOT NULL DEFAULT '',
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
      INSERT INTO collection_items
        (id, username_hash, imdb_id, title, title_lower, year, rate, user_rate, actors, plot, image, content_hash, rotten_tomatoes_rate, metacritic_rate)
      VALUES
        (1, 'user', 'tt001', 'Movie', 'movie', '2024', '8.0', 8.5, 'Actor', 'Plot', 'image', 'legacy-hash', '95%', '80/100');
      INSERT INTO collection_item_genres (item_id, genre) VALUES (1, 'Drama');
      INSERT INTO collection_item_tags (item_id, tag) VALUES
        (1, '#movie'),
        (1, '#watched'),
        (1, '#favorite'),
        (1, '#watch-later'),
        (1, 'custom');
    `);
    const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
    tempDirs.push(migrationsDir);
    writeFileSync(
      join(migrationsDir, '015_add_movie_tracker_list_type.sql'),
      readFileSync(join(process.cwd(), 'apps/server/src/migrations/015_add_movie_tracker_list_type.sql'), 'utf8')
    );

    await runMigrations(db, migrationsDir);

    expect(db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = 1 ORDER BY tag').all()).toEqual([
      { tag: '#favorite' },
      { tag: '#movie' },
      { tag: '#watch-later' },
      { tag: '#watched' },
      { tag: 'custom' },
    ]);

    const trackerItem = db
      .prepare('SELECT id, content_hash FROM collection_items WHERE imdb_id = ? AND list_type = ?')
      .get('tt001', 'movie-tracker') as { id: number; content_hash: string };
    expect(
      db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag').all(trackerItem.id)
    ).toEqual([
      { tag: '#favorite' },
      { tag: '#movie' },
      { tag: '#watch-later' },
      { tag: '#watched' },
      { tag: 'custom' },
    ]);
    expect(trackerItem.content_hash).toBe(
      getItemHash({
        image: 'image',
        title: 'Movie',
        genre: ['Drama'],
        IMDbId: 'tt001',
        externalProvider: 'omdb',
        externalItemId: 'tt001',
        tags: ['#favorite', '#movie', '#watch-later', '#watched', 'custom'],
        year: '2024',
        rate: '8.0',
        rottenTomatoesRate: '95%',
        metacriticRate: '80/100',
        userRate: 8.5,
        actors: 'Actor',
        plot: 'Plot',
        contentType: 'movie',
        favorite: false,
      })
    );

    db.close();
  });

  describe('016_add_collection_item_watched_at', () => {
    it('adds watched_at and backfills watched tracker items', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('016_add_collection_item_watched_at.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (username_hash, imdb_id, list_type, title, title_lower, year, rate, plot, image, content_hash, created_at, updated_at)
        VALUES
          ('user', 'tt-movie', 'movie-tracker', 'Movie', 'movie', '2024', '8.0', '', '', 'movie-hash', '2024-01-01 00:00:00', '2024-01-02 00:00:00'),
          ('user', 'tt-complete', 'series-tracker', 'Complete', 'complete', '2024', '8.0', '', '', 'complete-hash', '2024-02-01 00:00:00', '2024-03-01 00:00:00'),
          ('user', 'tt-incomplete', 'series-tracker', 'Incomplete', 'incomplete', '2024', '8.0', '', '', 'incomplete-hash', '2024-04-01 00:00:00', '2024-04-02 00:00:00');
      `);
      const completedSeriesId = Number(
        (db.prepare('SELECT id FROM collection_items WHERE imdb_id = ?').get('tt-complete')! as { id: number }).id
      );
      db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(completedSeriesId, '#completed');
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '016_add_collection_item_watched_at.sql'),
        join(migrationsDir, '016_add_collection_item_watched_at.sql')
      );

      await runMigrations(db, migrationsDir);

      expect(db.prepare('SELECT imdb_id, watched_at FROM collection_items ORDER BY imdb_id').all()).toEqual([
        { imdb_id: 'tt-complete', watched_at: '2024-03-01 00:00:00' },
        { imdb_id: 'tt-incomplete', watched_at: null },
        { imdb_id: 'tt-movie', watched_at: '2024-01-01 00:00:00' },
      ]);
      expect(
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
          .get('idx_collection_items_watched_at')
      ).toBeTruthy();

      db.close();
    });
  });

  describe('017_move_system_tags_to_columns', () => {
    it('derives columns from legacy system tags while preserving tags and recomputing item hashes', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('017_move_system_tags_to_columns.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (username_hash, imdb_id, list_type, title, title_lower, year, rate, user_rate, actors, plot, image, content_hash, rotten_tomatoes_rate, metacritic_rate, watched_at)
        VALUES
          ('user', 'tt-series', 'library', 'Series', 'series', '2024', '8.0', 8.5, 'Actor', 'Plot', 'image', 'legacy-hash', '95%', '80/100', '2024-01-02 00:00:00');
        INSERT INTO collection_item_genres (item_id, genre) VALUES (1, 'Drama');
        INSERT INTO collection_item_tags (item_id, tag) VALUES
          (1, '#series'),
          (1, '#favorite'),
          (1, '#completed'),
          (1, '#watch-later'),
          (1, '#episode-s01e01'),
          (1, '#episode-sxxeyy'),
          (1, 'custom');
        INSERT INTO tag_configs (username_hash, tag, color, use_for_image_border, use_for_text_color, use_for_image_badge, weight)
        VALUES
          ('user', '#favorite', '#111111', 1, 0, 0, 3),
          ('user', '#episode-s01e01', '#222222', 0, 1, 0, 2),
          ('user', '#episode-sxxeyy', '#444444', 0, 0, 1, 4),
          ('user', 'custom', '#333333', 0, 0, 1, 1);
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '017_move_system_tags_to_columns.sql'),
        join(migrationsDir, '017_move_system_tags_to_columns.sql')
      );

      await runMigrations(db, migrationsDir);

      const item = db
        .prepare('SELECT content_type, favorite, content_hash FROM collection_items WHERE id = ?')
        .get(1) as {
        content_type: string;
        favorite: number;
        content_hash: string;
      };
      expect(item).toEqual({
        content_type: 'series',
        favorite: 1,
        content_hash: getItemHash({
          image: 'image',
          title: 'Series',
          genre: ['Drama'],
          IMDbId: 'tt-series',
          externalProvider: 'omdb',
          externalItemId: 'tt-series',
          tags: ['#completed', '#episode-s01e01', '#episode-sxxeyy', '#favorite', '#series', '#watch-later', 'custom'],
          year: '2024',
          rate: '8.0',
          rottenTomatoesRate: '95%',
          metacriticRate: '80/100',
          userRate: 8.5,
          actors: 'Actor',
          plot: 'Plot',
          contentType: 'series',
          favorite: true,
        }),
      });
      expect(db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag').all(1)).toEqual([
        { tag: '#completed' },
        { tag: '#episode-s01e01' },
        { tag: '#episode-sxxeyy' },
        { tag: '#favorite' },
        { tag: '#series' },
        { tag: '#watch-later' },
        { tag: 'custom' },
      ]);
      expect(db.prepare('SELECT tag FROM tag_configs WHERE username_hash = ? ORDER BY tag').all('user')).toEqual([
        { tag: '#episode-s01e01' },
        { tag: '#episode-sxxeyy' },
        { tag: '#favorite' },
        { tag: 'custom' },
      ]);

      db.close();
    });
  });

  describe('018_remove_legacy_type_tags', () => {
    it('removes legacy type tags from all list types and recomputes item hashes', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('018_remove_legacy_type_tags.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (username_hash, imdb_id, list_type, title, title_lower, year, rate, user_rate, actors, plot, image, content_hash, rotten_tomatoes_rate, metacritic_rate, content_type, favorite, watched_at)
        VALUES
          ('user', 'tt-library', 'library', 'Library Movie', 'library movie', '2024', '8.0', NULL, 'Actor', 'Plot', 'image', 'legacy-library-hash', '', '', 'movie', 1, NULL),
          ('user', 'tt-watch-later', 'watch-later', 'Watch Later Series', 'watch later series', '2023', 'N/A', NULL, 'Actor', 'Plot', 'image', 'legacy-watch-later-hash', '', '', 'series', 0, NULL),
          ('user', 'tt-wishlist', 'wishlist', 'Wishlist Movie', 'wishlist movie', '2022', '7.0', 7.5, 'Actor', 'Plot', 'image', 'legacy-wishlist-hash', '90%', '80/100', 'movie', 0, NULL),
          ('user', 'tt-series-tracker', 'series-tracker', 'Tracked Series', 'tracked series', '2021', '9.0', NULL, 'Actor', 'Plot', 'image', 'legacy-series-tracker-hash', '', '', 'series', 0, '2024-01-02 00:00:00');
        INSERT INTO collection_item_genres (item_id, genre) VALUES
          (1, 'Drama'),
          (2, 'Action'),
          (3, 'Comedy'),
          (4, 'Sci-Fi');
        INSERT INTO collection_item_tags (item_id, tag) VALUES
          (1, '#movie'),
          (1, '#favorite'),
          (1, 'custom-library'),
          (2, '#series'),
          (2, 'custom-watch-later'),
          (3, '#movie'),
          (3, '#series'),
          (3, 'custom-wishlist'),
          (4, '#series'),
          (4, 'custom-series-tracker');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '018_remove_legacy_type_tags.sql'),
        join(migrationsDir, '018_remove_legacy_type_tags.sql')
      );

      await runMigrations(db, migrationsDir);

      expect(db.prepare('SELECT tag FROM collection_item_tags WHERE tag IN (?, ?)').all('#movie', '#series')).toEqual(
        []
      );
      expect(db.prepare('SELECT item_id, tag FROM collection_item_tags ORDER BY item_id, tag').all()).toEqual([
        { item_id: 1, tag: '#favorite' },
        { item_id: 1, tag: 'custom-library' },
        { item_id: 2, tag: 'custom-watch-later' },
        { item_id: 3, tag: 'custom-wishlist' },
        { item_id: 4, tag: 'custom-series-tracker' },
      ]);

      const libraryItem = db
        .prepare('SELECT content_hash FROM collection_items WHERE imdb_id = ?')
        .get('tt-library') as { content_hash: string };
      expect(libraryItem.content_hash).toBe(
        getItemHash({
          image: 'image',
          title: 'Library Movie',
          genre: ['Drama'],
          IMDbId: 'tt-library',
          externalProvider: 'omdb',
          externalItemId: 'tt-library',
          tags: ['#favorite', 'custom-library'],
          year: '2024',
          rate: '8.0',
          rottenTomatoesRate: '',
          metacriticRate: '',
          userRate: null,
          actors: 'Actor',
          plot: 'Plot',
          contentType: 'movie',
          favorite: true,
        })
      );

      db.close();
    });
  });

  describe('019_add_collection_item_external_provider', () => {
    it('removes duplicate legacy identities before creating the external identity index', async () => {
      const db = new Database(':memory:');
      db.exec(`
        CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE users (username_hash TEXT PRIMARY KEY, user_token_hash TEXT NOT NULL);
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
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          rotten_tomatoes_rate TEXT NOT NULL DEFAULT '',
          metacritic_rate TEXT NOT NULL DEFAULT '',
          watched_at TEXT,
          content_type TEXT NOT NULL DEFAULT 'movie',
          favorite INTEGER NOT NULL DEFAULT 0
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
        CREATE TABLE series_tracker_seasons (
          item_id INTEGER NOT NULL,
          season INTEGER NOT NULL,
          episodes INTEGER NOT NULL,
          episode_titles TEXT,
          PRIMARY KEY (item_id, season),
          FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
        );
        CREATE TABLE series_tracker_watched_episodes (
          item_id INTEGER NOT NULL,
          season INTEGER NOT NULL,
          episode INTEGER NOT NULL,
          PRIMARY KEY (item_id, season, episode),
          FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
        );
        CREATE TABLE ai_search_embeddings (
          item_id INTEGER NOT NULL,
          embedding_model TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          embedding_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (item_id, embedding_model),
          FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
        );
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (id, username_hash, imdb_id, list_type, title, title_lower, year, rate, user_rate, actors, plot, image, content_hash)
        VALUES
          (1, 'user', 'tt-duplicate', 'library', 'Kept', 'kept', '2024', '8.0', NULL, 'Actor', 'Plot', 'image', 'old-hash-1'),
          (2, 'user', 'tt-duplicate', 'library', 'Removed', 'removed', '2024', '8.0', NULL, 'Actor', 'Plot', 'image', 'old-hash-2');
        INSERT INTO collection_item_genres (item_id, genre) VALUES (1, 'Drama'), (2, 'Comedy');
        INSERT INTO collection_item_tags (item_id, tag) VALUES (1, 'kept-tag'), (2, 'removed-tag');
        INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (2, 1, 1);
        INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (2, 1, 1);
        INSERT INTO ai_search_embeddings (item_id, embedding_model, content_hash, embedding_json)
          VALUES (2, 'model', 'hash', '[0.1]');
      `);
      const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
      tempDirs.push(migrationsDir);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '019_add_collection_item_external_provider.sql'),
        join(migrationsDir, '019_add_collection_item_external_provider.sql')
      );

      await runMigrations(db, migrationsDir);

      expect(db.prepare('SELECT id, external_provider, external_item_id FROM collection_items').all()).toEqual([
        { id: 1, external_provider: 'omdb', external_item_id: 'tt-duplicate' },
      ]);
      expect(db.prepare('SELECT item_id, genre FROM collection_item_genres').all()).toEqual([
        { item_id: 1, genre: 'Drama' },
      ]);
      expect(db.prepare('SELECT item_id, tag FROM collection_item_tags').all()).toEqual([
        { item_id: 1, tag: 'kept-tag' },
      ]);
      expect(db.prepare('SELECT * FROM series_tracker_seasons').all()).toEqual([]);
      expect(db.prepare('SELECT * FROM series_tracker_watched_episodes').all()).toEqual([]);
      expect(db.prepare('SELECT * FROM ai_search_embeddings').all()).toEqual([]);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(db.prepare('PRAGMA foreign_key_list(collection_item_genres)').all()).toEqual([
        expect.objectContaining({ table: 'collection_items', from: 'item_id', to: 'id', on_delete: 'CASCADE' }),
      ]);
      expect(db.prepare('PRAGMA foreign_key_list(series_tracker_seasons)').all()).toEqual([
        expect.objectContaining({ table: 'collection_items', from: 'item_id', to: 'id', on_delete: 'CASCADE' }),
      ]);
      expect(() =>
        db
          .prepare(
            `INSERT INTO collection_items
              (username_hash, imdb_id, external_provider, external_item_id, list_type, title, title_lower, year, rate, actors, plot, image, content_hash)
             VALUES ('user', 'tt-other', 'omdb', 'tt-duplicate', 'library', 'Duplicate', 'duplicate', '2024', '8.0', 'Actor', 'Plot', 'image', 'hash')`
          )
          .run()
      ).toThrow();

      db.close();
    });
  });

  describe('020_add_collection_item_canonical_identity', () => {
    it('backfills canonical item IDs and external identity mappings', async () => {
      const { db, migrationsDir } = await preparePreMigrationState(
        '020_add_collection_item_canonical_identity.sql',
        tempDirs
      );
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (username_hash, imdb_id, external_provider, external_item_id, list_type, title, title_lower, year, rate, plot, image, content_hash)
        VALUES
          ('user', 'tt0133093', 'omdb', 'tt0133093', 'library', 'The Matrix', 'the matrix', '1999', '8.7', 'Plot', 'image', 'hash-1'),
          ('user', 'tt0000603', 'omdb', 'tt0000603', 'watch-later', 'Direct IMDb Movie', 'direct imdb movie', '1999', '8.7', 'Plot', 'image', 'hash-2'),
          ('user', 'tt123abc', 'omdb', 'tt123abc', 'wishlist', 'Malformed IMDb', 'malformed imdb', '1999', '8.7', 'Plot', 'image', 'hash-3');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '020_add_collection_item_canonical_identity.sql'),
        join(migrationsDir, '020_add_collection_item_canonical_identity.sql')
      );

      await runMigrations(db, migrationsDir);

      expect(
        db
          .prepare('SELECT external_provider, external_item_id, canonical_item_id FROM collection_items ORDER BY id')
          .all()
      ).toEqual([
        { external_provider: 'omdb', external_item_id: 'tt0133093', canonical_item_id: 'imdb:tt0133093' },
        { external_provider: 'omdb', external_item_id: 'tt0000603', canonical_item_id: 'imdb:tt0000603' },
        { external_provider: 'omdb', external_item_id: 'tt123abc', canonical_item_id: 'omdb:tt123abc' },
      ]);
      expect(
        db
          .prepare(
            'SELECT username_hash, external_provider, external_item_id, canonical_item_id FROM external_item_identities ORDER BY external_provider, external_item_id'
          )
          .all()
      ).toEqual([
        {
          username_hash: 'user',
          external_provider: 'imdb',
          external_item_id: 'tt0000603',
          canonical_item_id: 'imdb:tt0000603',
        },
        {
          username_hash: 'user',
          external_provider: 'imdb',
          external_item_id: 'tt0133093',
          canonical_item_id: 'imdb:tt0133093',
        },
        {
          username_hash: 'user',
          external_provider: 'omdb',
          external_item_id: 'tt0000603',
          canonical_item_id: 'imdb:tt0000603',
        },
        {
          username_hash: 'user',
          external_provider: 'omdb',
          external_item_id: 'tt0133093',
          canonical_item_id: 'imdb:tt0133093',
        },
        {
          username_hash: 'user',
          external_provider: 'omdb',
          external_item_id: 'tt123abc',
          canonical_item_id: 'omdb:tt123abc',
        },
      ]);

      const fks = db.prepare('PRAGMA foreign_key_list(external_item_identities)').all() as Array<{
        table: string;
        from: string;
        to: string;
        on_delete: string;
      }>;
      expect(fks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table: 'users',
            from: 'username_hash',
            to: 'username_hash',
            on_delete: 'CASCADE',
          }),
        ])
      );

      db.prepare("DELETE FROM users WHERE username_hash = 'user'").run();
      expect(db.prepare('SELECT * FROM external_item_identities').all()).toHaveLength(0);

      db.close();
    });
  });

  describe('021_add_unique_collection_item_canonical_identity', () => {
    it('removes duplicate canonical items and enforces unique canonical identities per list', async () => {
      const { db, migrationsDir } = await preparePreMigrationState(
        '021_add_unique_collection_item_canonical_identity.sql',
        tempDirs
      );
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, rate, plot, image, content_hash)
        VALUES
          ('user', 'tt001', 'omdb', 'tt001', 'imdb:tt001', 'library', 'Original', 'original', '2024', '8.0', 'Plot', 'image', 'hash-1'),
          ('user', 'tt001-alt', 'omdb', 'tt001-alt', 'imdb:tt001', 'library', 'Duplicate', 'duplicate', '2024', '8.0', 'Plot', 'image', 'hash-2'),
          ('user', 'tt001', 'omdb', 'tt001', 'imdb:tt001', 'watch-later', 'Other List', 'other list', '2024', '8.0', 'Plot', 'image', 'hash-3');
        INSERT INTO collection_item_tags (item_id, tag) VALUES (2, 'duplicate-tag');
        INSERT INTO collection_item_genres (item_id, genre) VALUES (2, 'Duplicate Genre');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '021_add_unique_collection_item_canonical_identity.sql'),
        join(migrationsDir, '021_add_unique_collection_item_canonical_identity.sql')
      );

      await runMigrations(db, migrationsDir);

      expect(db.prepare('SELECT title, canonical_item_id, list_type FROM collection_items ORDER BY id').all()).toEqual([
        { title: 'Original', canonical_item_id: 'imdb:tt001', list_type: 'library' },
        { title: 'Other List', canonical_item_id: 'imdb:tt001', list_type: 'watch-later' },
      ]);
      expect(db.prepare('SELECT * FROM collection_item_tags WHERE tag = ?').all('duplicate-tag')).toHaveLength(0);
      expect(db.prepare('SELECT * FROM collection_item_genres WHERE genre = ?').all('Duplicate Genre')).toHaveLength(0);
      expect(() =>
        db
          .prepare(
            `INSERT INTO collection_items
              (username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, rate, plot, image, content_hash)
             VALUES ('user', 'tt001-new', 'omdb', 'tt001-new', 'imdb:tt001', 'library', 'New Duplicate', 'new duplicate', '2024', '8.0', 'Plot', 'image', 'hash-4')`
          )
          .run()
      ).toThrow();

      db.close();
    });
  });

  describe('022_normalize_imdb_rating_text', () => {
    it('normalizes IMDb ratings with /10 denominators and recomputes content hashes', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('022_normalize_imdb_rating_text.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, rate, plot, actors, image, content_hash, content_type, favorite, rotten_tomatoes_rate, metacritic_rate)
        VALUES
          ('user', 'tt001', 'omdb', 'tt001', 'imdb:tt001', 'library', 'Rating Movie', 'rating movie', '2024', '8.0/10', 'Plot', 'Actor', 'image', 'stale-hash', 'movie', 0, '95%', '80/100'),
          ('user', 'tt002', 'omdb', 'tt002', 'imdb:tt002', 'library', 'Already Normalized', 'already normalized', '2024', '7.5', 'Plot', 'Actor', 'image', 'unchanged-hash', 'movie', 0, '95%', '80/100'),
          ('user', 'tt003', 'omdb', 'tt003', 'imdb:tt003', 'library', 'Unavailable', 'unavailable', '2024', 'N/A', 'Plot', 'Actor', 'image', 'unavailable-hash', 'movie', 0, '95%', '80/100');
        INSERT INTO external_item_identities (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
          VALUES ('user', 'imdb:tt001', 'imdb', 'tt001', 'provider');
        INSERT INTO collection_item_genres (item_id, genre) VALUES (1, 'Drama'), (2, 'Drama'), (3, 'Drama');
        INSERT INTO collection_item_tags (item_id, tag) VALUES (1, '#movie'), (2, '#movie'), (3, '#movie');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '022_normalize_imdb_rating_text.sql'),
        join(migrationsDir, '022_normalize_imdb_rating_text.sql')
      );

      await runMigrations(db, migrationsDir);

      const rows = db
        .prepare('SELECT imdb_id, rate, content_hash FROM collection_items ORDER BY imdb_id')
        .all() as Array<{
        imdb_id: string;
        rate: string;
        content_hash: string;
      }>;
      expect(rows.map(({ imdb_id, rate }) => ({ imdb_id, rate }))).toEqual([
        { imdb_id: 'tt001', rate: '8.0' },
        { imdb_id: 'tt002', rate: '7.5' },
        { imdb_id: 'tt003', rate: 'N/A' },
      ]);
      expect(rows[0]?.content_hash).toBe(
        getItemHash({
          image: 'image',
          title: 'Rating Movie',
          genre: ['Drama'],
          IMDbId: 'tt001',
          externalProvider: 'omdb',
          externalItemId: 'tt001',
          externalIds: [{ source: 'imdb', id: 'tt001' }],
          tags: ['#movie'],
          year: '2024',
          rate: '8.0',
          rottenTomatoesRate: '95%',
          metacriticRate: '80/100',
          userRate: null,
          actors: 'Actor',
          plot: 'Plot',
          contentType: 'movie',
          favorite: false,
        })
      );

      db.close();
    });
  });

  describe('023_open_external_provider_constraints', () => {
    it('drops closed provider checks and renames identity confidence values', async () => {
      const { db, migrationsDir } = await preparePreMigrationState(
        '023_open_external_provider_constraints.sql',
        tempDirs
      );
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, rate, plot, image, content_hash)
        VALUES
          ('user', 'tt001', 'omdb', 'tt001', 'imdb:tt001', 'library', 'Movie', 'movie', '2024', '8.0', 'Plot', 'image', 'hash-1'),
          ('user', null, 'omdb', 'custom-id', 'omdb:custom-id', 'watch-later', 'Custom', 'custom', '2024', '7.0', 'Plot', 'image', 'hash-2');
        INSERT INTO collection_item_genres (item_id, genre) VALUES (1, 'Drama'), (2, 'Action');
        INSERT INTO collection_item_tags (item_id, tag) VALUES (1, '#movie'), (2, '#custom');
        INSERT INTO series_tracker_seasons (item_id, season, episodes, episode_titles) VALUES (1, 1, 3, '[]');
        INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (1, 1, 1);
        INSERT INTO ai_search_embeddings (item_id, embedding_model, content_hash, embedding_json)
          VALUES (1, 'model', 'hash-1', '[0.1]');
        INSERT INTO external_item_identities
          (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
        VALUES
          ('user', 'imdb:tt001', 'omdb', 'tt001', 'fallback'),
          ('user', 'imdb:tt001', 'imdb', 'tt001', 'provider'),
          ('user', 'omdb:custom-id', 'omdb', 'custom-id', 'provider');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '023_open_external_provider_constraints.sql'),
        join(migrationsDir, '023_open_external_provider_constraints.sql')
      );

      await runMigrations(db, migrationsDir);

      expect(
        db
          .prepare(
            `SELECT external_provider, external_item_id, source_confidence
             FROM external_item_identities
             ORDER BY external_provider, external_item_id`
          )
          .all()
      ).toEqual([
        { external_provider: 'imdb', external_item_id: 'tt001', source_confidence: 'alias' },
        { external_provider: 'omdb', external_item_id: 'custom-id', source_confidence: 'primary' },
        { external_provider: 'omdb', external_item_id: 'tt001', source_confidence: 'primary' },
      ]);
      expect(
        db.prepare('SELECT title, external_provider, canonical_item_id FROM collection_items ORDER BY id').all()
      ).toEqual([
        { title: 'Movie', external_provider: 'omdb', canonical_item_id: 'imdb:tt001' },
        { title: 'Custom', external_provider: 'omdb', canonical_item_id: 'omdb:custom-id' },
      ]);
      expect(db.prepare('SELECT genre FROM collection_item_genres ORDER BY genre').all()).toEqual([
        { genre: 'Action' },
        { genre: 'Drama' },
      ]);
      expect(db.prepare('SELECT tag FROM collection_item_tags ORDER BY tag').all()).toEqual([
        { tag: '#custom' },
        { tag: '#movie' },
      ]);
      expect(db.prepare('SELECT season, episodes FROM series_tracker_seasons').all()).toEqual([
        { season: 1, episodes: 3 },
      ]);
      expect(db.prepare('SELECT season, episode FROM series_tracker_watched_episodes').all()).toEqual([
        { season: 1, episode: 1 },
      ]);
      expect(db.prepare('SELECT embedding_model FROM ai_search_embeddings').all()).toEqual([
        { embedding_model: 'model' },
      ]);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);

      expect(() =>
        db
          .prepare(
            `INSERT INTO collection_items
              (username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, rate, plot, image, content_hash)
             VALUES ('user', null, 'tmdb', '603', 'tmdb:603', 'library', 'Future Provider', 'future provider', '2024', '8.0', 'Plot', 'image', 'hash-3')`
          )
          .run()
      ).not.toThrow();
      expect(() =>
        db
          .prepare(
            `INSERT INTO external_item_identities
              (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
             VALUES ('user', 'tmdb:603', 'tmdb', '603', 'primary')`
          )
          .run()
      ).not.toThrow();

      db.close();
    });
  });

  describe('024_add_collection_feature_preferences', () => {
    it('adds a nullable collection feature preferences column and preserves existing settings', async () => {
      const { db, migrationsDir } = await preparePreMigrationState(
        '024_add_collection_feature_preferences.sql',
        tempDirs
      );
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO user_settings (username_hash, theme) VALUES ('user', 'dark');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '024_add_collection_feature_preferences.sql'),
        join(migrationsDir, '024_add_collection_feature_preferences.sql')
      );

      await runMigrations(db, migrationsDir);

      const columns = db.prepare('PRAGMA table_info(user_settings)').all() as Array<{ name: string }>;
      expect(columns.map((column) => column.name)).toContain('collection_feature_preferences');
      expect(
        db
          .prepare('SELECT theme, collection_feature_preferences FROM user_settings WHERE username_hash = ?')
          .get('user')
      ).toEqual({ theme: 'dark', collection_feature_preferences: null });

      db.close();
    });
  });

  describe('025_add_book_tracker', () => {
    it('adds book constraints, preserves relations, and upgrades non-null feature preferences', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('025_add_book_tracker.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token'), ('default-user', 'token');
        INSERT INTO user_settings (username_hash, collection_feature_preferences)
          VALUES ('user', '{"wishlist":false,"watchLater":true,"movieTracker":false,"seriesTracker":true}'),
                 ('default-user', NULL);
        INSERT INTO collection_items
          (username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, title, title_lower, year, rate, plot, image, content_hash)
          VALUES ('user', 'tt001', 'omdb', 'tt001', 'imdb:tt001', 'Movie', 'movie', '2024', '8.0', 'Plot', 'image', 'hash');
        INSERT INTO collection_item_genres (item_id, genre) VALUES (1, 'Drama');
        INSERT INTO collection_item_tags (item_id, tag) VALUES (1, 'owned');
        INSERT INTO ai_search_embeddings (item_id, embedding_model, content_hash, embedding_json)
          VALUES (1, 'model', 'hash', '[0.1]');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '025_add_book_tracker.sql'),
        join(migrationsDir, '025_add_book_tracker.sql')
      );

      await runMigrations(db, migrationsDir);

      db.prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, rate, plot, image, content_hash)
         VALUES ('user', 'openlibrary', '9780306406157', 'isbn:9780306406157', 'book-tracker', 'book', 'Book', 'book', '1965', '', '', '', 'book-hash')`
      ).run();
      const insertWithTypes = db.prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, list_type, content_type, title, title_lower, year, rate, plot, image, content_hash)
         VALUES ('user', 'omdb', ?, ?, ?, 'Item', 'item', '', '', '', '', ?)`
      );
      expect(() => insertWithTypes.run('bad-list', 'reading-list', 'book', 'bad-list-hash')).toThrow();
      expect(() => insertWithTypes.run('bad-content', 'library', 'podcast', 'bad-content-hash')).toThrow();
      expect(() => insertWithTypes.run('book-library', 'library', 'book', 'book-library-hash')).toThrow();
      expect(() => insertWithTypes.run('book-watch-later', 'watch-later', 'book', 'book-watch-later-hash')).toThrow();
      expect(() => insertWithTypes.run('book-wishlist', 'wishlist', 'book', 'book-wishlist-hash')).toThrow();
      expect(() => insertWithTypes.run('movie-book-tracker', 'book-tracker', 'movie', 'movie-book-hash')).toThrow();
      expect(() => insertWithTypes.run('series-book-tracker', 'book-tracker', 'series', 'series-book-hash')).toThrow();
      expect(db.prepare('SELECT genre FROM collection_item_genres').all()).toEqual([{ genre: 'Drama' }]);
      expect(db.prepare('SELECT tag FROM collection_item_tags').all()).toEqual([{ tag: 'owned' }]);
      expect(db.prepare('SELECT embedding_model FROM ai_search_embeddings').all()).toEqual([
        { embedding_model: 'model' },
      ]);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(
        db.prepare('SELECT collection_feature_preferences FROM user_settings WHERE username_hash = ?').get('user')
      ).toEqual({
        collection_feature_preferences:
          '{"wishlist":false,"watchLater":true,"movieTracker":false,"seriesTracker":true,"bookTracker":true}',
      });
      expect(
        db
          .prepare('SELECT collection_feature_preferences FROM user_settings WHERE username_hash = ?')
          .get('default-user')
      ).toEqual({ collection_feature_preferences: null });

      db.close();
    });
  });

  describe('026_normalize_collection_items', () => {
    it('normalizes ratings and tracker state while preserving items and every child relation', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('026_normalize_collection_items.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (id, username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, list_type, title,
           title_lower, year, rate, user_rate, actors, plot, image, content_hash, rotten_tomatoes_rate,
           metacritic_rate, watched_at, content_type, favorite)
        VALUES
          (10, 'user', 'tt010', 'omdb', 'tt010', 'imdb:tt010', 'movie-tracker', 'Movie', 'movie', '2024',
           '8.1', 9.5, 'Actor', 'Movie plot', 'movie.jpg', 'movie-hash', '91%', '74/100',
           '2025-01-02 03:04:05', 'movie', 1),
          (20, 'user', 'tt020', 'omdb', 'tt020', 'imdb:tt020', 'series-tracker', 'Series', 'series', '2023',
           '', NULL, 'Cast', 'Series plot', 'series.jpg', 'series-hash', '', '', NULL, 'series', 0),
          (30, 'user', NULL, 'custom', NULL, NULL, 'library', 'Library Series', 'library series', '2022',
           '7', NULL, '', '', '', 'library-hash', '', '', '2024-01-01', 'series', 0),
          (40, 'user', NULL, 'openlibrary', '9780306406157', 'isbn:9780306406157', 'book-tracker', 'Book',
           'book', '1965', '', NULL, 'Author', 'Book description', 'book.jpg', 'book-hash', '', '', NULL, 'book', 0);
        INSERT INTO collection_item_genres (item_id, genre) VALUES (10, 'Drama'), (20, 'Sci-Fi');
        INSERT INTO collection_item_tags (item_id, tag) VALUES (10, 'favorite'), (40, 'owned');
        INSERT INTO series_tracker_seasons (item_id, season, episodes, episode_titles)
          VALUES (20, 1, 2, '["Pilot","Finale"]');
        INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (20, 1, 1);
        INSERT INTO ai_search_embeddings
          (item_id, embedding_model, content_hash, embedding_json, created_at, updated_at)
          VALUES (10, 'model', 'movie-hash', '[0.1]', '2024-01-01', '2024-01-02');
        INSERT INTO external_item_identities
          (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence, created_at)
          VALUES ('user', 'imdb:tt010', 'omdb', 'tt010', 'primary', '2024-01-01');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '026_normalize_collection_items.sql'),
        join(migrationsDir, '026_normalize_collection_items.sql')
      );

      await runMigrations(db, migrationsDir);

      const columns = db.prepare('PRAGMA table_info(collection_items)').all() as Array<{
        name: string;
        notnull: number;
      }>;
      const columnNames = columns.map((column) => column.name);
      expect(columnNames).toEqual(
        expect.arrayContaining([
          'external_provider',
          'external_item_id',
          'canonical_item_id',
          'contributors',
          'description',
        ])
      );
      expect(columnNames).not.toEqual(
        expect.arrayContaining([
          'imdb_id',
          'rate',
          'rotten_tomatoes_rate',
          'metacritic_rate',
          'watched_at',
          'actors',
          'plot',
        ])
      );
      expect(columns.find((column) => column.name === 'year')?.notnull).toBe(1);
      expect(columns.find((column) => column.name === 'external_provider')?.notnull).toBe(1);
      expect(columns.find((column) => column.name === 'external_item_id')?.notnull).toBe(0);
      expect(columns.find((column) => column.name === 'canonical_item_id')?.notnull).toBe(0);

      expect(
        db
          .prepare(
            'SELECT id, external_item_id, canonical_item_id, contributors, description FROM collection_items ORDER BY id'
          )
          .all()
      ).toEqual([
        {
          id: 10,
          external_item_id: 'tt010',
          canonical_item_id: 'imdb:tt010',
          contributors: 'Actor',
          description: 'Movie plot',
        },
        {
          id: 20,
          external_item_id: 'tt020',
          canonical_item_id: 'imdb:tt020',
          contributors: 'Cast',
          description: 'Series plot',
        },
        { id: 30, external_item_id: null, canonical_item_id: null, contributors: '', description: '' },
        {
          id: 40,
          external_item_id: '9780306406157',
          canonical_item_id: 'isbn:9780306406157',
          contributors: 'Author',
          description: 'Book description',
        },
      ]);
      expect(
        db.prepare('SELECT item_id, source, value FROM collection_item_external_ratings ORDER BY item_id, source').all()
      ).toEqual([
        { item_id: 10, source: 'imdb', value: '8.1' },
        { item_id: 10, source: 'metacritic', value: '74/100' },
        { item_id: 10, source: 'rotten-tomatoes', value: '91%' },
        { item_id: 30, source: 'imdb', value: '7' },
      ]);
      expect(
        db.prepare('SELECT item_id, completed_at FROM collection_item_tracker_state ORDER BY item_id').all()
      ).toEqual([
        { item_id: 10, completed_at: '2025-01-02 03:04:05' },
        { item_id: 20, completed_at: null },
        { item_id: 30, completed_at: '2024-01-01' },
      ]);
      expect(db.prepare('SELECT * FROM collection_item_genres ORDER BY item_id').all()).toHaveLength(2);
      expect(db.prepare('SELECT * FROM collection_item_tags ORDER BY item_id').all()).toHaveLength(2);
      expect(db.prepare('SELECT * FROM series_tracker_seasons').all()).toEqual([
        { item_id: 20, season: 1, episodes: 2, episode_titles: '["Pilot","Finale"]' },
      ]);
      expect(db.prepare('SELECT * FROM series_tracker_watched_episodes').all()).toEqual([
        { item_id: 20, season: 1, episode: 1 },
      ]);
      expect(db.prepare('SELECT item_id, embedding_model FROM ai_search_embeddings').all()).toEqual([
        { item_id: 10, embedding_model: 'model' },
      ]);
      expect(
        db
          .prepare(
            `SELECT canonical_item_id, external_item_id
             FROM external_item_identities
             WHERE external_provider = 'imdb'
             ORDER BY external_item_id`
          )
          .all()
      ).toEqual([
        { canonical_item_id: 'imdb:tt010', external_item_id: 'tt010' },
        { canonical_item_id: 'imdb:tt020', external_item_id: 'tt020' },
      ]);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);

      const insertItem = db.prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, list_type, content_type, title, title_lower, year,
           contributors, description, image, content_hash)
         VALUES ('user', 'custom', ?, ?, ?, 'Item', 'item', '2025', '', '', '', ?)`
      );
      expect(() => insertItem.run('bad-movie', 'movie-tracker', 'series', 'bad-movie')).toThrow();
      expect(() => insertItem.run('bad-series', 'series-tracker', 'movie', 'bad-series')).toThrow();
      expect(() => insertItem.run('bad-book-list', 'library', 'book', 'bad-book-list')).toThrow();
      expect(() => insertItem.run('bad-book-type', 'book-tracker', 'movie', 'bad-book-type')).toThrow();
      expect(() => insertItem.run('library-movie', 'library', 'movie', 'library-movie')).not.toThrow();
      expect(() => insertItem.run('wishlist-series', 'wishlist', 'series', 'wishlist-series')).not.toThrow();
      expect(() => db.prepare("INSERT INTO collection_item_external_ratings VALUES (10, '', '1')").run()).toThrow();
      expect(() =>
        db.prepare("INSERT INTO collection_item_external_ratings VALUES (10, 'unknown', '1')").run()
      ).toThrow();
      expect(() => db.prepare("INSERT INTO collection_item_external_ratings VALUES (10, 'imdb', '')").run()).toThrow();
      expect(() => db.prepare('INSERT INTO collection_item_tracker_state (item_id) VALUES (9999)').run()).toThrow();

      db.prepare('DELETE FROM collection_items WHERE id IN (10, 20)').run();
      expect(db.prepare('SELECT * FROM collection_item_external_ratings').all()).toEqual([
        { item_id: 30, source: 'imdb', value: '7' },
      ]);
      expect(db.prepare('SELECT * FROM collection_item_tracker_state').all()).toEqual([
        { item_id: 30, completed_at: '2024-01-01' },
      ]);
      expect(db.prepare('SELECT * FROM collection_item_genres').all()).toEqual([]);
      expect(db.prepare('SELECT * FROM series_tracker_seasons').all()).toEqual([]);
      expect(db.prepare('SELECT * FROM series_tracker_watched_episodes').all()).toEqual([]);
      expect(db.prepare('SELECT * FROM ai_search_embeddings').all()).toEqual([]);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);

      await runMigrations(db, migrationsDir);
      expect(
        db
          .prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE id = '026_normalize_collection_items.sql'")
          .get()
      ).toEqual({ count: 1 });

      db.close();
    });

    it('normalizes legacy tracker types and preserves unmapped IMDb identities', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('026_normalize_collection_items.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, list_type, content_type,
           title, title_lower, year, rate, actors, plot, image, content_hash, watched_at)
        VALUES
          ('user', 'TT-BAD', 'omdb', NULL, NULL, 'movie-tracker', 'series', 'Bad Movie', 'bad movie', '2024',
           '', '', '', '', 'movie-hash', '2025-01-01'),
          ('user', 'tt-series', 'omdb', NULL, NULL, 'series-tracker', 'movie', 'Bad Series', 'bad series', '2024',
           '', '', '', '', 'series-hash', NULL);
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '026_normalize_collection_items.sql'),
        join(migrationsDir, '026_normalize_collection_items.sql')
      );

      await runMigrations(db, migrationsDir);
      expect(
        db
          .prepare(
            'SELECT external_item_id, canonical_item_id, list_type, content_type FROM collection_items ORDER BY id'
          )
          .all()
      ).toEqual([
        {
          external_item_id: 'tt-bad',
          canonical_item_id: 'imdb:tt-bad',
          list_type: 'movie-tracker',
          content_type: 'movie',
        },
        {
          external_item_id: 'tt-series',
          canonical_item_id: 'imdb:tt-series',
          list_type: 'series-tracker',
          content_type: 'series',
        },
      ]);
      expect(
        db
          .prepare(
            `SELECT canonical_item_id, external_item_id
             FROM external_item_identities
             WHERE external_provider = 'imdb'
             ORDER BY external_item_id`
          )
          .all()
      ).toEqual([
        { canonical_item_id: 'imdb:tt-bad', external_item_id: 'tt-bad' },
        { canonical_item_id: 'imdb:tt-series', external_item_id: 'tt-series' },
      ]);
      expect(
        db.prepare('SELECT item_id, completed_at FROM collection_item_tracker_state ORDER BY item_id').all()
      ).toEqual([
        { item_id: 1, completed_at: '2025-01-01' },
        { item_id: 2, completed_at: null },
      ]);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);

      db.close();
    });

    it('lowercases tt-shaped external ids that differ from legacy imdb_id', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('026_normalize_collection_items.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, list_type, content_type,
           title, title_lower, year, rate, actors, plot, image, content_hash)
        VALUES
          ('user', 'tt9999999', 'omdb', 'TT0133093', 'omdb:TT0133093', 'library', 'movie', 'Mixed', 'mixed', '2024',
           '', '', '', '', 'mixed-hash');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '026_normalize_collection_items.sql'),
        join(migrationsDir, '026_normalize_collection_items.sql')
      );

      await runMigrations(db, migrationsDir);
      expect(
        db
          .prepare('SELECT external_item_id, canonical_item_id FROM collection_items WHERE username_hash = ?')
          .get('user')
      ).toEqual({
        external_item_id: 'tt0133093',
        canonical_item_id: 'omdb:TT0133093',
      });

      db.close();
    });
  });

  describe('runner behavior', () => {
    it('runs the full migration chain 001 to 015 and produces the expected final schema', async () => {
      const db = new Database(':memory:');
      const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
      tempDirs.push(migrationsDir);

      const files = readdirSync(MIGRATIONS_SRC_DIR)
        .filter((file) => /^\d+_.+\.sql$/.test(file))
        .sort();

      for (const file of files) {
        copyFileSync(join(MIGRATIONS_SRC_DIR, file), join(migrationsDir, file));
      }

      await runMigrations(db, migrationsDir);

      db.exec(`
        INSERT INTO users (username_hash, user_token_hash, username) VALUES ('user1', 'tok1', 'Alice'), ('user2', 'tok2', 'Bob');
        INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent)
          VALUES ('user1', 'hash1', '2024-01-01T00:00:00Z', 'Mozilla/5.0');
        INSERT INTO refresh_tokens (username_hash, token_hash, created_at, user_agent)
          VALUES ('user1', 'hash2', '2024-01-01T00:00:00Z', 'Mozilla/5.0');
        INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, list_type, title, title_lower, year, user_rate,
           description, contributors, image, content_hash)
          VALUES ('user1', 'omdb', 'tt001', 'library', 'Movie', 'movie', '2020', 8.5, 'Plot', 'Actor', 'img', 'hash');
        INSERT INTO collection_item_external_ratings (item_id, source, value)
          VALUES (1, 'imdb', '8.0'), (1, 'rotten-tomatoes', '95%'), (1, 'metacritic', '80/100');
        INSERT INTO collection_item_genres (item_id, genre) VALUES (1, 'Drama');
        INSERT INTO collection_item_tags (item_id, tag) VALUES (1, '#movie'), (1, 'custom');
        INSERT INTO user_settings (username_hash, theme, animated_background, language, default_library_owner_share_code, collection_list_display_preferences)
          VALUES ('user1', 'dark', 1, 'en', 'share-abc', '{"grid":true}');
        INSERT INTO tag_configs (username_hash, tag, color, use_for_image_border, use_for_text_color, use_for_image_badge, weight)
          VALUES ('user1', '#movie', '#ff0000', 1, 0, 1, 10);
        INSERT INTO user_shares (owner_username_hash, shared_with_username_hash)
          VALUES ('user1', 'user2');
        INSERT INTO user_share_grants (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read, can_create, can_update, can_delete)
          VALUES ('user1', 'user2', 'library', 'movie', 1, 0, 0, 0),
                 ('user1', 'user2', 'library', 'series', 1, 0, 0, 0);
        INSERT INTO series_tracking_seasons (item_id, season, episodes, episode_titles)
          VALUES (1, 1, 3, '["E1","E2","E3"]');
        INSERT INTO series_completed_episodes (item_id, season, episode)
          VALUES (1, 1, 1), (1, 1, 2);
        INSERT INTO ai_search_embeddings (item_id, embedding_model, content_hash, embedding_json)
          VALUES (1, 'mxbai-embed-large', 'hash', '[0.1]');
      `);

      const applied = db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as Array<{ id: string }>;
      expect(applied).toHaveLength(files.length);

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
        name: string;
      }>;
      expect(tables.map((t) => t.name).filter((name) => name !== 'sqlite_sequence')).toEqual(
        expect.arrayContaining([
          'access_tokens',
          'ai_search_embeddings',
          'collection_item_external_ratings',
          'collection_item_genres',
          'collection_item_tags',
          'collection_item_tracker_state',
          'collection_items',
          'refresh_tokens',
          'schema_migrations',
          'series_tracking_seasons',
          'series_completed_episodes',
          'tag_configs',
          'user_settings',
          'user_shares',
          'users',
        ])
      );

      const itemCols = db.prepare('PRAGMA table_info(collection_items)').all() as Array<{
        name: string;
        type: string;
        notnull: number;
      }>;
      const itemColMap = new Map(itemCols.map((c) => [c.name, c]));
      expect(itemColMap.get('list_type')).toEqual(expect.objectContaining({ type: 'TEXT', notnull: 1 }));
      expect(itemColMap.get('user_rate')).toEqual(expect.objectContaining({ type: 'REAL', notnull: 0 }));
      expect(itemColMap.get('contributors')).toEqual(expect.objectContaining({ type: 'TEXT', notnull: 1 }));
      expect(itemColMap.get('description')).toEqual(expect.objectContaining({ type: 'TEXT', notnull: 1 }));
      expect(itemColMap.has('watched_at')).toBe(false);

      expect(() =>
        db
          .prepare(
            `
          INSERT INTO collection_items
            (username_hash, external_provider, external_item_id, list_type, title, title_lower, year,
             description, contributors, image, content_hash)
          VALUES ('user1', 'omdb', 'tt999', 'invalid', 'Bad', 'bad', '2020', 'Plot', 'Actor', 'img', 'hash2')
        `
          )
          .run()
      ).toThrow();

      expect(() =>
        db.prepare(`INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (1, 51, 10)`).run()
      ).toThrow();

      expect(() =>
        db.prepare(`INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (1, 1, 101)`).run()
      ).toThrow();

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name")
        .all() as Array<{ name: string }>;
      expect(indexes.map((i) => i.name)).toEqual(
        expect.arrayContaining([
          'idx_access_tokens_username',
          'idx_ai_search_embeddings_item',
          'idx_collection_item_genres_item',
          'idx_collection_item_tags_item',
          'idx_collection_items_content_type',
          'idx_collection_items_created',
          'idx_collection_items_external_identity',
          'idx_collection_items_favorite',
          'idx_collection_items_list_type',
          'idx_collection_items_username',
          'idx_collection_item_tracker_state_completed_at',
          'idx_refresh_tokens_username',
          'idx_series_tracking_seasons_item',
          'idx_series_completed_episodes_item',
          'idx_tag_configs_username',
          'idx_user_shares_owner',
          'idx_user_shares_shared_with',
        ])
      );

      db.close();
    });

    it('is idempotent when run multiple times against the same database', async () => {
      const db = new Database(':memory:');
      const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
      tempDirs.push(migrationsDir);

      const files = readdirSync(MIGRATIONS_SRC_DIR)
        .filter((file) => /^\d+_.+\.sql$/.test(file))
        .sort();

      for (const file of files) {
        copyFileSync(join(MIGRATIONS_SRC_DIR, file), join(migrationsDir, file));
      }

      await runMigrations(db, migrationsDir);
      db.exec(`INSERT INTO users (username_hash, user_token_hash) VALUES ('user1', 'tok1');`);

      await runMigrations(db, migrationsDir);

      const applied = db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as Array<{ id: string }>;
      expect(applied).toHaveLength(files.length);
      expect(db.prepare('SELECT username_hash FROM users').all()).toEqual([{ username_hash: 'user1' }]);

      db.close();
    });

    it('resumes from partial application without re-running already applied migrations', async () => {
      const db = new Database(':memory:');
      const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
      tempDirs.push(migrationsDir);

      const files = readdirSync(MIGRATIONS_SRC_DIR)
        .filter((file) => /^\d+_.+\.sql$/.test(file))
        .sort();

      const firstBatch = files.slice(0, 5);
      for (const file of firstBatch) {
        copyFileSync(join(MIGRATIONS_SRC_DIR, file), join(migrationsDir, file));
      }

      await runMigrations(db, migrationsDir);
      const appliedAfterFirst = db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as Array<{
        id: string;
      }>;
      expect(appliedAfterFirst).toHaveLength(5);

      for (const file of files.slice(5)) {
        copyFileSync(join(MIGRATIONS_SRC_DIR, file), join(migrationsDir, file));
      }

      await runMigrations(db, migrationsDir);
      const appliedAfterSecond = db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as Array<{
        id: string;
      }>;
      expect(appliedAfterSecond).toHaveLength(files.length);

      db.close();
    });

    it('does not record a migration that fails, and throws the error', async () => {
      const db = new Database(':memory:');
      const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
      tempDirs.push(migrationsDir);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      copyFileSync(join(MIGRATIONS_SRC_DIR, '001_initial_schema.sql'), join(migrationsDir, '001_initial_schema.sql'));
      await runMigrations(db, migrationsDir);

      writeFileSync(join(migrationsDir, '002_bad_migration.sql'), 'INVALID SQL HERE;');

      await expect(runMigrations(db, migrationsDir)).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();

      const applied = db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as Array<{ id: string }>;
      expect(applied).toEqual([{ id: '001_initial_schema.sql' }]);

      consoleErrorSpy.mockRestore();
      db.close();
    });

    it('rolls back self-transaction DDL and schema marker and restores migration pragmas', async () => {
      const db = new Database(':memory:');
      const migrationsDir = mkdtempSync(join(tmpdir(), 'collection-tracker-migrations-'));
      tempDirs.push(migrationsDir);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      copyFileSync(join(MIGRATIONS_SRC_DIR, '001_initial_schema.sql'), join(migrationsDir, '001_initial_schema.sql'));
      await runMigrations(db, migrationsDir);
      writeFileSync(
        join(migrationsDir, '002_bad_transaction.sql'),
        `PRAGMA foreign_keys = OFF;
         PRAGMA legacy_alter_table = ON;
         BEGIN IMMEDIATE;
         CREATE TABLE rollback_probe (id INTEGER PRIMARY KEY);
         INSERT INTO schema_migrations (id) VALUES ('002_bad_transaction.sql');
         INVALID SQL HERE;
         COMMIT;
         PRAGMA foreign_keys = ON;
         PRAGMA legacy_alter_table = OFF;`
      );

      await expect(runMigrations(db, migrationsDir)).rejects.toThrow();

      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rollback_probe'").get()
      ).toBeUndefined();
      expect(
        db.prepare('SELECT id FROM schema_migrations WHERE id = ?').get('002_bad_transaction.sql')
      ).toBeUndefined();
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(db.pragma('legacy_alter_table', { simple: true })).toBe(0);

      consoleErrorSpy.mockRestore();
      db.close();
    });
  });

  describe('027_rename_list_types_and_feature_prefs', () => {
    it('renames list_type values to intent-first names', async () => {
      const { db, migrationsDir } = await preparePreMigrationState(
        '027_rename_list_types_and_feature_prefs.sql',
        tempDirs
      );
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
           title, title_lower, year, user_rate, contributors, description, image, content_hash)
        VALUES
          ('user', 'omdb', 'tt-wl', 'imdb:tt-wl', 'watch-later', 'movie', 'WL', 'wl', '2020', NULL, '', '', '', 'h1'),
          ('user', 'omdb', 'tt-st', 'imdb:tt-st', 'series-tracker', 'series', 'ST', 'st', '2020', NULL, '', '', '', 'h2'),
          ('user', 'omdb', 'tt-mt', 'imdb:tt-mt', 'movie-tracker', 'movie', 'MT', 'mt', '2020', NULL, '', '', '', 'h3'),
          ('user', 'openlibrary', '9780140328721', 'isbn:9780140328721', 'book-tracker', 'book', 'BK', 'bk', '2020', NULL, '', '', '', 'h4');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '027_rename_list_types_and_feature_prefs.sql'),
        join(migrationsDir, '027_rename_list_types_and_feature_prefs.sql')
      );

      await runMigrations(db, migrationsDir);

      expect(db.prepare('SELECT list_type FROM collection_items ORDER BY external_item_id').all()).toEqual([
        { list_type: 'books' },
        { list_type: 'watched' },
        { list_type: 'watching' },
        { list_type: 'watchlist' },
      ]);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'collection_items' AND name = 'idx_collection_items_list_type'"
          )
          .get()
      ).toEqual({ name: 'idx_collection_items_list_type' });
      db.close();
    });
  });

  describe('028_rewrite_feature_preference_keys', () => {
    it('rewrites legacy feature preference JSON keys', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('028_rewrite_feature_preference_keys.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO user_settings (username_hash, collection_feature_preferences)
        VALUES (
          'user',
          '{"wishlist":false,"watchLater":true,"movieTracker":false,"seriesTracker":true,"bookTracker":true}'
        );
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '028_rewrite_feature_preference_keys.sql'),
        join(migrationsDir, '028_rewrite_feature_preference_keys.sql')
      );

      await runMigrations(db, migrationsDir);

      const stored = db
        .prepare('SELECT collection_feature_preferences FROM user_settings WHERE username_hash = ?')
        .get('user') as { collection_feature_preferences: string };
      expect(JSON.parse(stored.collection_feature_preferences)).toEqual({
        wishlist: false,
        watchlist: true,
        watched: false,
        watching: true,
        books: true,
      });
      db.close();
    });
  });

  describe('029_tracking_finished_book_progress', () => {
    it('renames tracking hubs, rewrites prefs, adds progress columns, and allows books on want-lists', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('029_tracking_finished_book_progress.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO user_settings (username_hash, collection_feature_preferences)
        VALUES (
          'user',
          '{"wishlist":true,"watchlist":true,"watched":false,"watching":true,"books":true}'
        );
        INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
           title, title_lower, year, user_rate, contributors, description, image, content_hash)
        VALUES
          ('user', 'omdb', 'tt-st', 'imdb:tt-st', 'watching', 'series', 'ST', 'st', '2020', NULL, '', '', '', 'h1'),
          ('user', 'omdb', 'tt-mt', 'imdb:tt-mt', 'watched', 'movie', 'MT', 'mt', '2020', NULL, '', '', '', 'h2'),
          ('user', 'openlibrary', '9780140328721', 'isbn:9780140328721', 'books', 'book', 'BK', 'bk', '2020', NULL, '', '', '', 'h3');
        INSERT INTO collection_item_tracker_state (item_id, completed_at)
        SELECT id, NULL FROM collection_items WHERE list_type IN ('watching', 'watched');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '029_tracking_finished_book_progress.sql'),
        join(migrationsDir, '029_tracking_finished_book_progress.sql')
      );

      await runMigrations(db, migrationsDir);

      expect(db.prepare('SELECT list_type FROM collection_items ORDER BY external_item_id').all()).toEqual([
        { list_type: 'books' },
        { list_type: 'finished' },
        { list_type: 'tracking' },
      ]);
      const stored = db
        .prepare('SELECT collection_feature_preferences FROM user_settings WHERE username_hash = ?')
        .get('user') as { collection_feature_preferences: string };
      expect(JSON.parse(stored.collection_feature_preferences)).toEqual({
        wishlist: true,
        watchlist: true,
        finished: false,
        tracking: true,
        books: true,
      });
      const trackerColumns = db.prepare('PRAGMA table_info(collection_item_tracker_state)').all() as Array<{
        name: string;
      }>;
      expect(trackerColumns.map((column) => column.name).sort()).toEqual([
        'completed_at',
        'item_id',
        'progress_current',
        'progress_total',
      ]);
      expect(() =>
        db
          .prepare(
            `INSERT INTO collection_items
              (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
               title, title_lower, year, user_rate, contributors, description, image, content_hash)
             VALUES ('user', 'openlibrary', '9780000000002', 'isbn:9780000000002', 'wishlist', 'book',
                     'Wish Book', 'wish book', '2021', NULL, '', '', '', 'h4')`
          )
          .run()
      ).not.toThrow();
      expect(() =>
        db
          .prepare(
            `INSERT INTO collection_items
              (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
               title, title_lower, year, user_rate, contributors, description, image, content_hash)
             VALUES ('user', 'openlibrary', '9780000000003', 'isbn:9780000000003', 'tracking', 'book',
                     'Reading', 'reading', '2021', NULL, '', '', '', 'h5')`
          )
          .run()
      ).not.toThrow();
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      db.close();
    });
  });

  describe('031_merge_finished_into_tracking', () => {
    it('merges finished into tracking and drops finished feature pref', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('031_merge_finished_into_tracking.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO user_settings (username_hash, collection_feature_preferences)
        VALUES (
          'user',
          '{"wishlist":true,"watchlist":true,"finished":true,"tracking":false,"books":true}'
        );
        INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
           title, title_lower, year, user_rate, contributors, description, image, content_hash)
        VALUES
          ('user', 'omdb', 'tt-movie', 'imdb:tt-movie', 'finished', 'movie', 'M', 'm', '2020', NULL, '', '', '', 'h1'),
          ('user', 'omdb', 'tt-series', 'imdb:tt-series', 'tracking', 'series', 'S', 's', '2020', NULL, '', '', '', 'h2'),
          ('user', 'openlibrary', '9780140328721', 'isbn:9780140328721', 'finished', 'book', 'BF', 'bf', '2020', NULL, '', '', '', 'h3'),
          ('user', 'openlibrary', '9780140328721', 'isbn:9780140328721', 'tracking', 'book', 'BT', 'bt', '2020', NULL, '', '', '', 'h4');
        INSERT INTO collection_item_tracker_state (item_id, completed_at, progress_current, progress_total)
        SELECT id, CASE WHEN list_type = 'finished' THEN CURRENT_TIMESTAMP ELSE NULL END, NULL, NULL
        FROM collection_items;
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '031_merge_finished_into_tracking.sql'),
        join(migrationsDir, '031_merge_finished_into_tracking.sql')
      );

      await runMigrations(db, migrationsDir);

      expect(db.prepare('SELECT list_type, content_type, title FROM collection_items ORDER BY title').all()).toEqual([
        { list_type: 'tracking', content_type: 'book', title: 'BF' },
        { list_type: 'tracking', content_type: 'movie', title: 'M' },
        { list_type: 'tracking', content_type: 'series', title: 'S' },
      ]);
      const stored = db
        .prepare('SELECT collection_feature_preferences FROM user_settings WHERE username_hash = ?')
        .get('user') as { collection_feature_preferences: string };
      expect(JSON.parse(stored.collection_feature_preferences)).toEqual({
        books: true,
        wishlist: true,
        watchlist: true,
        tracking: true,
      });
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      const movieState = db
        .prepare(
          `SELECT completed_at IS NOT NULL AS completed
           FROM collection_item_tracker_state
           WHERE item_id = (SELECT id FROM collection_items WHERE title = 'M')`
        )
        .get() as { completed: 0 | 1 };
      expect(movieState.completed).toBe(1);
      expect(() =>
        db
          .prepare(
            `INSERT INTO collection_items
              (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
               title, title_lower, year, user_rate, contributors, description, image, content_hash)
             VALUES ('user', 'omdb', 'tt-new-movie', 'imdb:tt-new-movie', 'tracking', 'movie',
                     'NM', 'nm', '2022', NULL, '', '', '', 'h5')`
          )
          .run()
      ).not.toThrow();
      db.close();
    });
  });

  describe('030_rename_series_completed_episodes', () => {
    it('renames watched episodes table to completed episodes', async () => {
      const { db, migrationsDir } = await preparePreMigrationState(
        '030_rename_series_completed_episodes.sql',
        tempDirs
      );
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
           title, title_lower, year, user_rate, contributors, description, image, content_hash)
        VALUES ('user', 'omdb', 'tt-st', 'imdb:tt-st', 'tracking', 'series', 'ST', 'st', '2020', NULL, '', '', '', 'h1');
        INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (1, 1, 1), (1, 1, 2);
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '030_rename_series_completed_episodes.sql'),
        join(migrationsDir, '030_rename_series_completed_episodes.sql')
      );

      await runMigrations(db, migrationsDir);

      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'series_completed_episodes'").get()
      ).toEqual({ name: 'series_completed_episodes' });
      expect(
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'series_tracker_watched_episodes'")
          .get()
      ).toBeUndefined();
      expect(
        db.prepare('SELECT season, episode FROM series_completed_episodes ORDER BY season, episode').all()
      ).toEqual([
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ]);
      expect(
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_series_completed_episodes_item'"
          )
          .get()
      ).toEqual({ name: 'idx_series_completed_episodes_item' });
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      db.close();
    });
  });

  describe('032_fix_tracking_pref_default_and_rename_seasons', () => {
    it('defaults missing tracking pref to true and renames seasons table', async () => {
      const { db, migrationsDir } = await preparePreMigrationState(
        '032_fix_tracking_pref_default_and_rename_seasons.sql',
        tempDirs
      );
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO user_settings (username_hash, collection_feature_preferences)
        VALUES (
          'user',
          '{"wishlist":true,"watchlist":true,"books":true}'
        );
        INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
           title, title_lower, year, user_rate, contributors, description, image, content_hash)
        VALUES ('user', 'omdb', 'tt-st', 'imdb:tt-st', 'tracking', 'series', 'ST', 'st', '2020', NULL, '', '', '', 'h1');
        INSERT INTO series_tracker_seasons (item_id, season, episodes, episode_titles)
        VALUES (1, 1, 3, '[]');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '032_fix_tracking_pref_default_and_rename_seasons.sql'),
        join(migrationsDir, '032_fix_tracking_pref_default_and_rename_seasons.sql')
      );

      await runMigrations(db, migrationsDir);

      const stored = db
        .prepare('SELECT collection_feature_preferences FROM user_settings WHERE username_hash = ?')
        .get('user') as { collection_feature_preferences: string };
      expect(JSON.parse(stored.collection_feature_preferences)).toEqual({
        books: true,
        wishlist: true,
        watchlist: true,
        tracking: true,
      });
      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'series_tracking_seasons'").get()
      ).toEqual({ name: 'series_tracking_seasons' });
      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'series_tracker_seasons'").get()
      ).toBeUndefined();
      expect(db.prepare('SELECT season, episodes FROM series_tracking_seasons').all()).toEqual([
        { season: 1, episodes: 3 },
      ]);
      expect(
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_series_tracking_seasons_item'")
          .get()
      ).toEqual({ name: 'idx_series_tracking_seasons_item' });
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      db.close();
    });
  });

  describe('033_rename_watchlist_to_up_next', () => {
    it('renames watchlist list type and feature pref key to up-next / upNext', async () => {
      const { db, migrationsDir } = await preparePreMigrationState('033_rename_watchlist_to_up_next.sql', tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES ('user', 'token');
        INSERT INTO user_settings (username_hash, collection_feature_preferences)
        VALUES (
          'user',
          '{"wishlist":true,"watchlist":false,"tracking":true,"books":true}'
        );
        INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
           title, title_lower, year, user_rate, contributors, description, image, content_hash)
        VALUES
          ('user', 'omdb', 'tt-wl', 'imdb:tt-wl', 'watchlist', 'movie', 'WL', 'wl', '2020', NULL, '', '', '', 'h1'),
          ('user', 'omdb', 'tt-lib', 'imdb:tt-lib', 'library', 'movie', 'LIB', 'lib', '2020', NULL, '', '', '', 'h2');
      `);
      copyFileSync(
        join(MIGRATIONS_SRC_DIR, '033_rename_watchlist_to_up_next.sql'),
        join(migrationsDir, '033_rename_watchlist_to_up_next.sql')
      );

      await runMigrations(db, migrationsDir);

      expect(db.prepare('SELECT list_type, title FROM collection_items ORDER BY title').all()).toEqual([
        { list_type: 'library', title: 'LIB' },
        { list_type: 'up-next', title: 'WL' },
      ]);
      const stored = db
        .prepare('SELECT collection_feature_preferences FROM user_settings WHERE username_hash = ?')
        .get('user') as { collection_feature_preferences: string };
      expect(JSON.parse(stored.collection_feature_preferences)).toEqual({
        books: true,
        wishlist: true,
        upNext: false,
        tracking: true,
      });
      expect(() =>
        db
          .prepare(
            `INSERT INTO collection_items
              (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
               title, title_lower, year, user_rate, contributors, description, image, content_hash)
             VALUES ('user', 'omdb', 'tt-new', 'imdb:tt-new', 'watchlist', 'movie',
                     'Bad', 'bad', '2022', NULL, '', '', '', 'h3')`
          )
          .run()
      ).toThrow();
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      db.close();
    });
  });

  describe('034_share_grants_by_list_and_content', () => {
    const migrationFile = '034_share_grants_by_list_and_content.sql';

    it('preserves effective relationships and removes relationships without permissions', async () => {
      const { db, migrationsDir } = await preparePre034ShareState(tempDirs);
      copyFileSync(join(MIGRATIONS_SRC_DIR, migrationFile), join(migrationsDir, migrationFile));

      await runMigrations(db, migrationsDir);

      expect(
        db
          .prepare('SELECT id, owner_username_hash, shared_with_username_hash, created_at FROM user_shares ORDER BY id')
          .all()
      ).toEqual([
        {
          id: 10,
          owner_username_hash: 'owner',
          shared_with_username_hash: 'reader',
          created_at: '2026-01-01 00:00:00',
        },
        {
          id: 20,
          owner_username_hash: 'owner',
          shared_with_username_hash: 'editor',
          created_at: '2026-02-01 00:00:00',
        },
      ]);
      expect(
        db
          .prepare(
            `SELECT shared_with_username_hash, list_type, content_type,
                    can_read, can_create, can_update, can_delete
             FROM user_share_grants
             ORDER BY shared_with_username_hash, content_type`
          )
          .all()
      ).toEqual([
        {
          shared_with_username_hash: 'editor',
          list_type: 'library',
          content_type: 'movie',
          can_read: 1,
          can_create: 1,
          can_update: 1,
          can_delete: 0,
        },
        {
          shared_with_username_hash: 'editor',
          list_type: 'library',
          content_type: 'series',
          can_read: 1,
          can_create: 1,
          can_update: 1,
          can_delete: 0,
        },
        {
          shared_with_username_hash: 'reader',
          list_type: 'library',
          content_type: 'movie',
          can_read: 1,
          can_create: 0,
          can_update: 0,
          can_delete: 0,
        },
        {
          shared_with_username_hash: 'reader',
          list_type: 'library',
          content_type: 'series',
          can_read: 1,
          can_create: 0,
          can_update: 0,
          can_delete: 0,
        },
      ]);
      expect(db.prepare('PRAGMA table_info(user_shares)').all()).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'can_read' })])
      );
      expect(db.prepare('SELECT id FROM schema_migrations WHERE id = ?').get(migrationFile)).toEqual({
        id: migrationFile,
      });
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      db.close();
    });

    it('rolls back schema, data, grants, and marker when migration fails before commit', async () => {
      const { db, migrationsDir } = await preparePre034ShareState(tempDirs);
      const migrationSql = readFileSync(join(MIGRATIONS_SRC_DIR, migrationFile), 'utf8').replace(
        `INSERT INTO schema_migrations (id) VALUES ('${migrationFile}');`,
        `INSERT INTO missing_table (id) VALUES (1);\nINSERT INTO schema_migrations (id) VALUES ('${migrationFile}');`
      );
      writeFileSync(join(migrationsDir, migrationFile), migrationSql);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(runMigrations(db, migrationsDir)).rejects.toThrow('no such table: missing_table');

      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_share_grants'").get()
      ).toBeUndefined();
      expect(
        db.prepare('SELECT id, can_read, can_create, can_update, can_delete FROM user_shares ORDER BY id').all()
      ).toEqual([
        { id: 10, can_read: 1, can_create: 0, can_update: 0, can_delete: 0 },
        { id: 20, can_read: 1, can_create: 1, can_update: 1, can_delete: 0 },
        { id: 30, can_read: 0, can_create: 0, can_update: 0, can_delete: 0 },
      ]);
      expect(db.prepare('SELECT id FROM schema_migrations WHERE id = ?').get(migrationFile)).toBeUndefined();
      expect(db.inTransaction).toBe(false);
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(db.pragma('legacy_alter_table', { simple: true })).toBe(0);
      db.close();
    });

    it('normalizes mutation-only legacy shares to readable grants', async () => {
      const { db, migrationsDir } = await preparePre034ShareState(tempDirs);
      db.exec(`
        INSERT INTO users (username_hash, user_token_hash) VALUES
          ('creator', 'creator-token'),
          ('updater', 'updater-token'),
          ('deleter', 'deleter-token');
        INSERT INTO user_shares
          (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
        VALUES
          ('owner', 'creator', 0, 1, 0, 0),
          ('owner', 'updater', 0, 0, 1, 0),
          ('owner', 'deleter', 0, 0, 0, 1);
      `);
      copyFileSync(join(MIGRATIONS_SRC_DIR, migrationFile), join(migrationsDir, migrationFile));

      await runMigrations(db, migrationsDir);

      expect(
        db
          .prepare(
            `SELECT shared_with_username_hash, content_type, can_read, can_create, can_update, can_delete
             FROM user_share_grants
             WHERE shared_with_username_hash IN ('creator', 'updater', 'deleter')
             ORDER BY shared_with_username_hash, content_type`
          )
          .all()
      ).toEqual([
        {
          shared_with_username_hash: 'creator',
          content_type: 'movie',
          can_read: 1,
          can_create: 1,
          can_update: 0,
          can_delete: 0,
        },
        {
          shared_with_username_hash: 'creator',
          content_type: 'series',
          can_read: 1,
          can_create: 1,
          can_update: 0,
          can_delete: 0,
        },
        {
          shared_with_username_hash: 'deleter',
          content_type: 'movie',
          can_read: 1,
          can_create: 0,
          can_update: 0,
          can_delete: 1,
        },
        {
          shared_with_username_hash: 'deleter',
          content_type: 'series',
          can_read: 1,
          can_create: 0,
          can_update: 0,
          can_delete: 1,
        },
        {
          shared_with_username_hash: 'updater',
          content_type: 'movie',
          can_read: 1,
          can_create: 0,
          can_update: 1,
          can_delete: 0,
        },
        {
          shared_with_username_hash: 'updater',
          content_type: 'series',
          can_read: 1,
          can_create: 0,
          can_update: 1,
          can_delete: 0,
        },
      ]);
      db.close();
    });
  });

  describe('035_add_collection_cursor_indexes', () => {
    it('adds the alphabetical cursor index', async () => {
      const migrationFile = '035_add_collection_cursor_indexes.sql';
      const { db, migrationsDir } = await preparePreMigrationState(migrationFile, tempDirs);
      copyFileSync(join(MIGRATIONS_SRC_DIR, migrationFile), join(migrationsDir, migrationFile));

      await runMigrations(db, migrationsDir);

      const indexes = db
        .prepare(
          `SELECT name, sql FROM sqlite_master
           WHERE type = 'index'
             AND name = 'idx_collection_items_list_title_id'
           ORDER BY name`
        )
        .all();
      expect(indexes).toEqual([
        expect.objectContaining({
          name: 'idx_collection_items_list_title_id',
          sql: expect.stringContaining('username_hash, list_type, title_lower, id'),
        }),
      ]);
      expect(db.prepare('SELECT id FROM schema_migrations WHERE id = ?').get(migrationFile)).toEqual({
        id: migrationFile,
      });
      db.close();
    });
  });
});
