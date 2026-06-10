CREATE TABLE IF NOT EXISTS series_tracker_watched_episodes (
  item_id INTEGER NOT NULL,
  season INTEGER NOT NULL CHECK (season >= 1 AND season <= 50),
  episode INTEGER NOT NULL CHECK (episode >= 1 AND episode <= 100),
  PRIMARY KEY (item_id, season, episode),
  FOREIGN KEY (item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_series_tracker_watched_episodes_item ON series_tracker_watched_episodes(item_id);

-- Migrate existing episode progress tags from collection_item_tags to the new table.
-- Legacy tags represented "watched up to" the tagged episode, so expand them through season metadata.
WITH RECURSIVE legacy_progress AS (
  SELECT
    cit.item_id,
    CAST(SUBSTR(cit.tag, 11, 2) AS INTEGER) AS target_season,
    CAST(SUBSTR(cit.tag, 14, 2) AS INTEGER) AS target_episode
  FROM collection_item_tags AS cit
  WHERE cit.tag LIKE '#episode-s__e__'
), episode_numbers(item_id, season, episode, max_episode) AS (
  SELECT
    legacy_progress.item_id,
    seasons.season,
    1,
    CASE
      WHEN seasons.season = legacy_progress.target_season THEN MIN(legacy_progress.target_episode, seasons.episodes)
      ELSE seasons.episodes
    END
  FROM legacy_progress
  INNER JOIN series_tracker_seasons AS seasons ON seasons.item_id = legacy_progress.item_id
  WHERE seasons.season < legacy_progress.target_season
     OR seasons.season = legacy_progress.target_season

  UNION ALL

  SELECT item_id, season, episode + 1, max_episode
  FROM episode_numbers
  WHERE episode < max_episode
)
INSERT OR IGNORE INTO series_tracker_watched_episodes (item_id, season, episode)
SELECT item_id, season, episode
FROM episode_numbers;

-- Preserve the tagged episode when no season metadata exists yet.
INSERT OR IGNORE INTO series_tracker_watched_episodes (item_id, season, episode)
SELECT
  legacy_progress.item_id,
  legacy_progress.target_season,
  legacy_progress.target_episode
FROM (
  SELECT
    cit.item_id,
    CAST(SUBSTR(cit.tag, 11, 2) AS INTEGER) AS target_season,
    CAST(SUBSTR(cit.tag, 14, 2) AS INTEGER) AS target_episode
  FROM collection_item_tags AS cit
  WHERE cit.tag LIKE '#episode-s__e__'
) AS legacy_progress
WHERE NOT EXISTS (
  SELECT 1
  FROM series_tracker_seasons AS seasons
  WHERE seasons.item_id = legacy_progress.item_id
    AND seasons.season = legacy_progress.target_season
);

-- Delete the migrated episode progress tags from collection_item_tags
DELETE FROM collection_item_tags
WHERE tag LIKE '#episode-s__e__';
