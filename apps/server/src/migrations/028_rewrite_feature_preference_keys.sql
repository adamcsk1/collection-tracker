-- Rewrite stored feature preference JSON keys to modern intent-first names.
UPDATE user_settings
SET collection_feature_preferences = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(collection_feature_preferences, '"watchLater"', '"watchlist"'),
      '"movieTracker"',
      '"watched"'
    ),
    '"seriesTracker"',
    '"watching"'
  ),
  '"bookTracker"',
  '"books"'
)
WHERE collection_feature_preferences IS NOT NULL;
