export const COLLECTION_LIST_DISPLAY_RATINGS = ['imdb', 'rottenTomatoes', 'metacritic', 'user'] as const;

export type CollectionListDisplayRatingModel = (typeof COLLECTION_LIST_DISPLAY_RATINGS)[number];

export interface CollectionListDisplayPreferencesModel {
  showYear: boolean;
  showSharedIcon: boolean;
  preferredRating: CollectionListDisplayRatingModel;
  imdbRatingFallback: boolean;
}

export const DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES: CollectionListDisplayPreferencesModel = {
  showYear: true,
  showSharedIcon: true,
  preferredRating: 'imdb',
  imdbRatingFallback: false,
};
