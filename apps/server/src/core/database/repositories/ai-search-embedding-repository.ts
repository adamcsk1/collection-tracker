import Database from 'better-sqlite3';

export const findAiSearchEmbedding = (
  db: Database.Database,
  itemId: number,
  embeddingModel: string,
  contentHash: string
): number[] | undefined => {
  const row = db
    .prepare(
      `SELECT embedding_json
       FROM ai_search_embeddings
       WHERE item_id = ? AND embedding_model = ? AND content_hash = ?`
    )
    .get(itemId, embeddingModel, contentHash) as { embedding_json: string } | undefined;

  if (!row) return undefined;

  try {
    const parsed = JSON.parse(row.embedding_json) as unknown;
    return Array.isArray(parsed) && parsed.every((value) => typeof value === 'number') ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const upsertAiSearchEmbedding = (
  db: Database.Database,
  itemId: number,
  embeddingModel: string,
  contentHash: string,
  embedding: number[]
): void => {
  db.prepare(
    `INSERT INTO ai_search_embeddings (item_id, embedding_model, content_hash, embedding_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(item_id, embedding_model) DO UPDATE SET
       content_hash = excluded.content_hash,
       embedding_json = excluded.embedding_json,
       updated_at = CURRENT_TIMESTAMP`
  ).run(itemId, embeddingModel, contentHash, JSON.stringify(embedding));
};
