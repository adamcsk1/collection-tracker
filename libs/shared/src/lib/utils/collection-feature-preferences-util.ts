import { CollectionFeaturePreferencesModel } from '../models/collection-feature-preferences-model';

export const isCollectionFeaturePreferences = (value: unknown): value is CollectionFeaturePreferencesModel => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  return (
    Object.keys(candidate).length === 4 &&
    typeof candidate['wishlist'] === 'boolean' &&
    typeof candidate['watchLater'] === 'boolean' &&
    typeof candidate['movieTracker'] === 'boolean' &&
    typeof candidate['seriesTracker'] === 'boolean'
  );
};
