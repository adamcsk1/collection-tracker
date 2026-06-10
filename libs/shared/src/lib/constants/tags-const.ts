export const WATCHED_TAG = '#watched';
export const COMPLETED_TAG = '#completed';
export const FAVORITE_TAG = '#favorite';
export const WATCH_LATER_TAG = '#watch-later';
export const WISHLIST_TAG = '#wishlist';
export const MOVIE_TAG = '#movie';
export const SERIES_TAG = '#series';

export const INTERNAL_USED_TAGS = [
  WATCHED_TAG,
  COMPLETED_TAG,
  FAVORITE_TAG,
  WATCH_LATER_TAG,
  WISHLIST_TAG,
  MOVIE_TAG,
  SERIES_TAG,
];

// Virtual tags are not really stored, but are used to filter items based on their watched status.
export const VIRTUAL_UNWATCHED_TAG = '#unwatched';
export const VIRTUAL_UNCOMPLETED_TAG = '#uncompleted';

export const VIRTUAL_TAGS = [VIRTUAL_UNWATCHED_TAG, VIRTUAL_UNCOMPLETED_TAG];
