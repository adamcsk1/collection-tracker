const Database = require('better-sqlite3');
const { readFileSync, mkdirSync, readdirSync } = require('fs');
const { createHash } = require('crypto');
const { join } = require('path');

const dataDir = process.env.DATA_DIR || join(__dirname, '..', 'env');
const envPath = join(dataDir, '.env');
const dbDir = join(dataDir, 'database');
const dbPath = join(dbDir, 'collection-tracker.sqlite');

require('dotenv').config({ path: envPath, override: true });

const salt = process.env.SALT || '';

mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const MIGRATION_PATTERN = /^\d+_.+\.sql$/;
const migrationsDir = '/app/server/migrations';

const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => MIGRATION_PATTERN.test(file))
  .sort();

for (const file of migrationFiles) {
  const filePath = join(migrationsDir, file);
  const sql = readFileSync(filePath, 'utf-8');
  db.exec(sql);
  db.prepare('INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)').run(file);
}

const username = 'cypress';
const token =
  'few deal cave wagon only forget frame food exchange swung steam by stick proud produce give naturally accept combine breath handsome freedom firm market is helpful special matter powder machine known lovely quickly require mission grandfather larger next stick lay best opposite good apple diameter pitch mysterious range hole whom raw country studying structure serious cost glad series black detail quickly happy arrive stand harbor middle affect around sand related told suddenly even leather deal design get shape noise space six calm root recall against shelf cookies enemy birth count even hungry image liquid rhythm mark express where color contain further end easy slightly observe barn something slide factor spell arrange piano paid still hill those parent health baby along upward upper spin circle firm fifth completely drop nothing detail difficult combine putting';

const usernameHash = createHash('sha512').update(username + salt).digest('hex');
const userTokenHash = createHash('sha512').update(token + salt).digest('hex');

db.prepare('INSERT OR IGNORE INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(
  usernameHash,
  userTokenHash
);

db.close();
console.log('E2E database seeded successfully.');
