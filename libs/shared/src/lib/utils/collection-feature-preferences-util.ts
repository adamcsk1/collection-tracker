import { CollectionFeaturePreferencesModel } from '../models/collection-feature-preferences-model';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const REQUIRED_KEYS = ['wishlist', 'watchlist', 'finished', 'tracking', 'books'] as const;

const normalizeFeaturePreferenceRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...record };
  if (!('finished' in normalized) && 'watched' in normalized) {
    normalized['finished'] = normalized['watched'];
    delete normalized['watched'];
  }
  if (!('tracking' in normalized) && 'watching' in normalized) {
    normalized['tracking'] = normalized['watching'];
    delete normalized['watching'];
  }
  if (!('finished' in normalized) && 'movieTracker' in normalized) {
    normalized['finished'] = normalized['movieTracker'];
    delete normalized['movieTracker'];
  }
  if (!('tracking' in normalized) && 'seriesTracker' in normalized) {
    normalized['tracking'] = normalized['seriesTracker'];
    delete normalized['seriesTracker'];
  }
  if (!('watchlist' in normalized) && 'watchLater' in normalized) {
    normalized['watchlist'] = normalized['watchLater'];
    delete normalized['watchLater'];
  }
  if (!('books' in normalized) && 'bookTracker' in normalized) {
    normalized['books'] = normalized['bookTracker'];
    delete normalized['bookTracker'];
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
    watchlist: record['watchlist'] as boolean,
    finished: record['finished'] as boolean,
    tracking: record['tracking'] as boolean,
    books: record['books'] as boolean,
  };
};

export const isCollectionFeaturePreferences = (value: unknown): value is CollectionFeaturePreferencesModel =>
  parseCollectionFeaturePreferences(value) !== undefined;
