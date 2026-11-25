ALTER TABLE collection_items ADD COLUMN planned_year INTEGER
  CHECK (planned_year IS NULL OR (typeof(planned_year) = 'integer' AND planned_year BETWEEN 1000 AND 9999));

CREATE INDEX idx_collection_items_planned_year
  ON collection_items(username_hash, planned_year, content_type);
