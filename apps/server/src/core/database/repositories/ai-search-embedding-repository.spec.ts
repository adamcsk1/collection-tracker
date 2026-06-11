import { describe, expect, it } from 'vitest';
import { getDatabase } from '../database';
import { findAiSearchEmbedding, upsertAiSearchEmbedding } from './ai-search-embedding-repository';

describe('ai-search-embedding-repository', () => {
  const setupItem = (): number => {
    const db = getDatabase();
    db.prepare('INSERT OR IGNORE INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    const result = db
      .prepare(
        `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('user', 'tt0133093', 'The Matrix', 'the matrix', '1999', 'R', 'A computer hacker.', '', 'hash');

    return Number(result.lastInsertRowid);
  };

  it('returns a cached embedding for the matching model and content hash', () => {
    const db = getDatabase();
    const itemId = setupItem();

    upsertAiSearchEmbedding(db, itemId, 'mxbai-embed-large', 'content-a', [0.1, 0.2, 0.3]);

    expect(findAiSearchEmbedding(db, itemId, 'mxbai-embed-large', 'content-a')).toEqual([0.1, 0.2, 0.3]);
  });

  it('ignores stale embeddings for changed item content', () => {
    const db = getDatabase();
    const itemId = setupItem();

    upsertAiSearchEmbedding(db, itemId, 'mxbai-embed-large', 'content-a', [0.1, 0.2, 0.3]);

    expect(findAiSearchEmbedding(db, itemId, 'mxbai-embed-large', 'content-b')).toBeUndefined();
  });

  it('replaces an existing embedding for the same item and model', () => {
    const db = getDatabase();
    const itemId = setupItem();

    upsertAiSearchEmbedding(db, itemId, 'mxbai-embed-large', 'content-a', [0.1, 0.2, 0.3]);
    upsertAiSearchEmbedding(db, itemId, 'mxbai-embed-large', 'content-b', [0.4, 0.5, 0.6]);

    expect(findAiSearchEmbedding(db, itemId, 'mxbai-embed-large', 'content-b')).toEqual([0.4, 0.5, 0.6]);
    expect(findAiSearchEmbedding(db, itemId, 'mxbai-embed-large', 'content-a')).toBeUndefined();
  });
});
