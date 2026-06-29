import { Signal } from '@angular/core';
import { CollectionItemContentTypeModel } from '@shared/models/api-model';
import { CollectionItemYearModel } from '@shared/models/collection-item-model';

export interface ItemDialogFormModel {
  title: string;
  IMDbId: string;
  year: CollectionItemYearModel;
  rate: string;
  rottenTomatoesRate: string;
  metacriticRate: string;
  userRate: number | null;
  image: string;
  genreText: string;
  tagsText: string;
  actors: string;
  plot: string;
  contentType: CollectionItemContentTypeModel;
}

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
  tags: Signal<string>;
  watchedUpTo: Signal<string>;
}
