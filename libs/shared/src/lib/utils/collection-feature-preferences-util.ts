import { CollectionFeaturePreferencesModel } from '../models/collection-feature-preferences-model';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const REQUIRED_KEYS = ['wishlist', 'upNext', 'tracking', 'books', 'music'] as const;

const normalizeFeaturePreferenceRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...record };

  const finishedEnabled =
    normalized['finished'] === true || normalized['watched'] === true || normalized['movieTracker'] === true;
  const trackingEnabled =
    normalized['tracking'] === true || normalized['watching'] === true || normalized['seriesTracker'] === true;

  if ('tracking' in normalized || 'watching' in normalized || 'seriesTracker' in normalized || finishedEnabled) {
    normalized['tracking'] = trackingEnabled || finishedEnabled;
  }

  delete normalized['finished'];
  delete normalized['watched'];
  delete normalized['movieTracker'];
  delete normalized['watching'];
  delete normalized['seriesTracker'];

  if (!('upNext' in normalized)) {
    if ('up-next' in normalized) {
      normalized['upNext'] = normalized['up-next'];
    } else if ('watchlist' in normalized) {
      normalized['upNext'] = normalized['watchlist'];
    } else if ('watchLater' in normalized) {
      normalized['upNext'] = normalized['watchLater'];
    }
  }
  delete normalized['up-next'];
  delete normalized['watchlist'];
  delete normalized['watchLater'];

  if (!('books' in normalized) && 'bookTracker' in normalized) {
    normalized['books'] = normalized['bookTracker'];
  }
  delete normalized['bookTracker'];

  if (!('music' in normalized)) {
    normalized['music'] = true;
  }

  return normalized;
};

export const parseCollectionFeaturePreferences = (value: unknown): CollectionFeaturePreferencesModel | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = normalizeFeaturePreferenceRecord(value as Record<string, unknown>);
  const keys = Object.keys(record);
  if (keys.length !== REQUIRED_KEYS.length) return undefined;
  if (!REQUIRED_KEYS.every((key) => keys.includes(key) && isBoolean(record[key]))) return undefined;

  return {
    wishlist: record['wishlist'] as boolean,
    upNext: record['upNext'] as boolean,
    tracking: record['tracking'] as boolean,
    books: record['books'] as boolean,
    music: record['music'] as boolean,
  };
};

export const isCollectionFeaturePreferences = (value: unknown): value is CollectionFeaturePreferencesModel =>
  parseCollectionFeaturePreferences(value) !== undefined;
