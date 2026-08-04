import { CollectionFeaturePreferencesModel } from '../models/collection-feature-preferences-model';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const REQUIRED_KEYS = ['wishlist', 'watchlist', 'watched', 'watching', 'books'] as const;

export const parseCollectionFeaturePreferences = (value: unknown): CollectionFeaturePreferencesModel | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== REQUIRED_KEYS.length) return undefined;
  if (!REQUIRED_KEYS.every((key) => keys.includes(key) && isBoolean(record[key]))) return undefined;

  return {
    wishlist: record['wishlist'] as boolean,
    watchlist: record['watchlist'] as boolean,
    watched: record['watched'] as boolean,
    watching: record['watching'] as boolean,
    books: record['books'] as boolean,
  };
};

export const isCollectionFeaturePreferences = (value: unknown): value is CollectionFeaturePreferencesModel =>
  parseCollectionFeaturePreferences(value) !== undefined;
