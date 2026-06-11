CREATE TABLE IF NOT EXISTS ai_search_embeddings (
  item_id INTEGER NOT NULL,
  embedding_model TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, embedding_model),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_search_embeddings_item ON ai_search_embeddings(item_id);
