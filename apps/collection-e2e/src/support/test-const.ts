export const COLLECTION_LIST_TYPES = ['library', 'up-next', 'wishlist', 'tracking', 'books', 'music'] as const;

export const DEFAULT_USER_SETTINGS = {
  theme: 'system',
  animatedBackground: true,
  language: 'en',
  defaultCollectionOwners: [],
  collectionListDisplayPreferences: {
    showYear: true,
    showSharedIcon: true,
    preferredRating: 'imdb',
    imdbRatingFallback: false,
  },
  collectionFeaturePreferences: {
    books: true,
    music: true,
    wishlist: true,
    upNext: true,
    tracking: true,
  },
};
