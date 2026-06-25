import { Signal } from '@angular/core';

export interface ItemDialogTranslations {
  actors: Signal<string>;
  altPoster: Signal<string>;
  delete: Signal<string>;
  edit: Signal<string>;
  fallbackNotAvailable: Signal<string>;
  fallbackUnknownYear: Signal<string>;
  genre: Signal<string>;
  labelMetacriticRate: Signal<string>;
  labelRottenTomatoesRate: Signal<string>;
  labelUserRate: Signal<string>;
  linkWebSearch: Signal<string>;
  linkYouTubeTrailer: Signal<string>;
  links: Signal<string>;
  manageSeriesMetadata: Signal<string>;
  manageWatchedEpisodes: Signal<string>;
  markAsFavorite: Signal<string>;
  markAsUnwatched: Signal<string>;
  markAsWatched: Signal<string>;
  copyToSeriesTracker: Signal<string>;
  moveToMovieTracker: Signal<string>;
  moveToSeriesTracker: Signal<string>;
  plot: Signal<string>;
  ratings: Signal<string>;
  removeFavorite: Signal<string>;
  removeFromSeriesTracker: Signal<string>;
  systemTags: Signal<string>;
  tags: Signal<string>;
  watchedUpTo: Signal<string>;
}
