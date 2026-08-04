-- Rename episode progress table to completed-episodes naming.
ALTER TABLE series_tracker_watched_episodes RENAME TO series_completed_episodes;

DROP INDEX IF EXISTS idx_series_tracker_watched_episodes_item;
CREATE INDEX IF NOT EXISTS idx_series_completed_episodes_item ON series_completed_episodes(item_id);
