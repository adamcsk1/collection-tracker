import { DEFAULT_EXTERNAL_METADATA_PROVIDER } from '@shared/constants/external-metadata-const';
import type {
  ExternalItemIdentityModel,
  ExternalMetadataProviderNameModel,
} from '@shared/models/external-metadata-provider-model';
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { getItemHash } from '../utils/collection-item-util';
import { hashText } from '../crypto';

const MIGRATION_PATTERN = /^\d+_.+\.sql$/;
const RUNNER_MANAGED_MIGRATION_START = 39;

const recomputeCollectionItemHashes = (db: Database.Database): void => {
  const tableExists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'collection_items'")
    .get();
  if (!tableExists) return;

  const rows = db.prepare('SELECT * FROM collection_items').all() as Array<{
    id: number;
    username_hash: string;
    imdb_id: string | null;
    external_provider?: ExternalMetadataProviderNameModel;
    external_item_id?: string;
    canonical_item_id?: string;
    title: string;
    year: string;
    rate: string;
    rotten_tomatoes_rate: string | null;
    metacritic_rate: string | null;
    user_rate: number | null;
    actors: string;
    plot: string;
    image: string;
    content_type?: 'movie' | 'series' | 'book';
    favorite?: 0 | 1;
  }>;

  const genresByItem = db.prepare('SELECT genre FROM collection_item_genres WHERE item_id = ? ORDER BY genre');
  const tagsByItem = db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag');
  const updateHash = db.prepare('UPDATE collection_items SET content_hash = ? WHERE id = ?');
  const externalItemIdentitiesTableExists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'external_item_identities'")
    .get();
  const externalIdsByCanonicalItem = externalItemIdentitiesTableExists
    ? db.prepare(
        `SELECT external_provider AS source, external_item_id AS id
           FROM external_item_identities
          WHERE username_hash = ? AND canonical_item_id = ?
          ORDER BY external_provider, external_item_id`
      )
    : undefined;

  const transaction = db.transaction(() => {
    for (const row of rows) {
      const genre = (genresByItem.all(row.id) as Array<{ genre: string }>).map((genreRow) => genreRow.genre);
      const tags = (tagsByItem.all(row.id) as Array<{ tag: string }>).map((tagRow) => tagRow.tag);
      const externalIds = row.canonical_item_id
        ? (externalIdsByCanonicalItem?.all(row.username_hash, row.canonical_item_id) as
            ExternalItemIdentityModel[] | undefined)
        : undefined;
      updateHash.run(
        getItemHash({
          image: row.image,
          title: row.title,
          genre,
          IMDbId: row.imdb_id ?? row.external_item_id ?? '',
          externalProvider: row.external_provider ?? DEFAULT_EXTERNAL_METADATA_PROVIDER,
          externalItemId: row.external_item_id ?? row.imdb_id ?? '',
          externalIds,
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

const migrateCollectionOwnerDefaults = (db: Database.Database): void => {
  const rows = db
    .prepare(
      `SELECT username_hash, default_library_owner_share_code
       FROM user_settings
       WHERE default_library_owner_share_code IS NOT NULL AND TRIM(default_library_owner_share_code) <> ''`
    )
    .all() as Array<{
    username_hash: string;
    default_library_owner_share_code: string;
  }>;
  const ownerHashesByShareCode = new Map(
    (db.prepare('SELECT username_hash FROM users').all() as Array<{ username_hash: string }>).map((user) => [
      hashText(user.username_hash).slice(0, 16),
      user.username_hash,
    ])
  );
  const insertDefault = db.prepare(
    `INSERT INTO collection_owner_defaults (username_hash, list_type, content_type, owner_username_hash)
     VALUES (?, 'library', ?, ?)`
  );
  for (const row of rows) {
    const ownerHash = ownerHashesByShareCode.get(row.default_library_owner_share_code);
    if (!ownerHash || ownerHash === row.username_hash) continue;
    for (const contentType of ['movie', 'series']) {
      const valid = db
        .prepare(
          `SELECT 1 FROM user_share_grants
           WHERE owner_username_hash = ? AND shared_with_username_hash = ?
             AND list_type = 'library' AND content_type = ? AND can_create = 1`
        )
        .get(ownerHash, row.username_hash, contentType);
      if (valid) insertDefault.run(row.username_hash, contentType, ownerHash);
    }
  }
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
      if (file === '038_add_collection_owner_defaults.sql') {
        db.transaction(() => {
          db.exec(sql);
          migrateCollectionOwnerDefaults(db);
          db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(file);
        })();
        appliedIds.add(file);
        continue;
      }
      if (Number.parseInt(file, 10) >= RUNNER_MANAGED_MIGRATION_START) {
        db.transaction(() => {
          db.exec(sql);
          db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(file);
        })();
        appliedIds.add(file);
        continue;
      }
      // Self-transaction migrations insert their schema marker before COMMIT so schema and marker remain atomic.
      db.exec(sql);
      if (
        file === '015_add_movie_tracker_list_type.sql' ||
        file === '017_move_system_tags_to_columns.sql' ||
        file === '018_remove_legacy_type_tags.sql' ||
        file === '019_add_collection_item_external_provider.sql' ||
        file === '022_normalize_imdb_rating_text.sql'
      ) {
        recomputeCollectionItemHashes(db);
      }
      const migrationRecorded = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?').get(file);
      if (!migrationRecorded) db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(file);
      appliedIds.add(file);
    } catch (error: unknown) {
      if (db.inTransaction) db.exec('ROLLBACK');
      db.pragma('foreign_keys = ON');
      db.pragma('legacy_alter_table = OFF');
      if (error instanceof Error) {
        console.error(`Migration failed: ${file} - ${error.message}`);
      }
      throw error;
    }
  }
};
