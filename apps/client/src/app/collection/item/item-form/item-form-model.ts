import { Signal } from '@angular/core';
import { CollectionItemContentTypeModel } from '@shared/models/api-model';
import { CollectionItemYearModel } from '@shared/models/collection-item-model';

export interface ItemFormModel {
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
  progressCurrent: number | null;
  progressTotal: number | null;
}

export interface ItemDialogTranslations {
  actors: Signal<string>;
  authors: Signal<string>;
  altPoster: Signal<string>;
  delete: Signal<string>;
  edit: Signal<string>;
  fallbackNotAvailable: Signal<string>;
  fallbackUnknownYear: Signal<string>;
  genre: Signal<string>;
  subjects: Signal<string>;
  description: Signal<string>;
  isbn: Signal<string>;
  labelMetacriticRate: Signal<string>;
  labelRottenTomatoesRate: Signal<string>;
  labelUserRate: Signal<string>;
  linkWebSearch: Signal<string>;
  linkYouTubeTrailer: Signal<string>;
  links: Signal<string>;
  manageSeriesMetadata: Signal<string>;
  manageCompletedEpisodes: Signal<string>;
  markAsFavorite: Signal<string>;
  markAsUnfinished: Signal<string>;
  markAsFinished: Signal<string>;
  copyToTracking: Signal<string>;
  moveToFinished: Signal<string>;
  moveToTracking: Signal<string>;
  openInTracking: Signal<string>;
  plot: Signal<string>;
  ratings: Signal<string>;
  removeFavorite: Signal<string>;
  removeFromTracking: Signal<string>;
  tags: Signal<string>;
  watchedUpTo: Signal<string>;
  readingProgress: Signal<string>;
  pagesRead: Signal<string>;
  totalPages: Signal<string>;
}
