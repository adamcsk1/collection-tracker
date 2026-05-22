CREATE TABLE IF NOT EXISTS series_tracker_seasons (
  item_id INTEGER NOT NULL,
  season INTEGER NOT NULL CHECK (season >= 1 AND season <= 50),
  episodes INTEGER NOT NULL CHECK (episodes >= 1 AND episodes <= 100),
  PRIMARY KEY (item_id, season),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_series_tracker_seasons_item ON series_tracker_seasons(item_id);
