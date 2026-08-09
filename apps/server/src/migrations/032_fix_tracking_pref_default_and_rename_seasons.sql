-- Fix asymmetric tracking feature-pref default from 031 (missing tracking/finished became false).
-- Rename series_tracker_seasons to series_tracking_seasons for naming consistency.

PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;

BEGIN TRANSACTION;

UPDATE user_settings
SET collection_feature_preferences = CASE
  WHEN collection_feature_preferences IS NULL THEN NULL
  WHEN json_valid(collection_feature_preferences) THEN
    json_object(
      'books', CASE WHEN COALESCE(json_extract(collection_feature_preferences, '$.books'), 1) = 1 THEN json('true') ELSE json('false') END,
      'wishlist', CASE WHEN COALESCE(json_extract(collection_feature_preferences, '$.wishlist'), 1) = 1 THEN json('true') ELSE json('false') END,
      'watchlist', CASE WHEN COALESCE(json_extract(collection_feature_preferences, '$.watchlist'), 1) = 1 THEN json('true') ELSE json('false') END,
      'tracking', CASE
        WHEN COALESCE(json_extract(collection_feature_preferences, '$.tracking'), 1) = 1 THEN json('true')
        WHEN COALESCE(json_extract(collection_feature_preferences, '$.finished'), 0) = 1 THEN json('true')
        ELSE json('false')
      END
    )
  ELSE collection_feature_preferences
END
WHERE collection_feature_preferences IS NOT NULL;

ALTER TABLE series_tracker_seasons RENAME TO series_tracking_seasons;

DROP INDEX IF EXISTS idx_series_tracker_seasons_item;
CREATE INDEX IF NOT EXISTS idx_series_tracking_seasons_item ON series_tracking_seasons(item_id);

INSERT INTO schema_migrations (id) VALUES ('032_fix_tracking_pref_default_and_rename_seasons.sql');

COMMIT;

PRAGMA foreign_keys = ON;
PRAGMA legacy_alter_table = OFF;
