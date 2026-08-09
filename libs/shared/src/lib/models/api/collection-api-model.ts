import type { CursorPageModel } from '../api-envelope-model';
import type { CollectionItemModel, CollectionListTypeModel } from '../collection-item-model';
import type { ExternalItemIdentityModel } from '../external-metadata-provider-model';

export type CollectionItemApiModel = CollectionItemModel & Required<Pick<CollectionItemModel, 'ownerShareCode'>>;

export type CollectionItemTypeFilter = 'movie' | 'series' | 'book';
export type CollectionItemTagMode = 'any' | 'all';
export type CollectionItemOrderBy = 'createdAt' | 'alphabet';
export type CollectionItemOrderDirection = 'asc' | 'desc';

export type CollectionItemSharedFilter = 'mine' | 'shared';

export interface CollectionItemFiltersApiModel {
  search?: string;
  tags?: string[];
  genres?: string[];
  tagMode?: CollectionItemTagMode;
  type?: CollectionItemTypeFilter;
  watched?: boolean;
  completed?: boolean;
  favorite?: boolean;
  shared?: CollectionItemSharedFilter;
  listType?: CollectionListTypeModel;
  orderBy?: CollectionItemOrderBy;
  orderDirection?: CollectionItemOrderDirection;
}

export interface CollectionItemsPageModel {
  items: CollectionItemApiModel[];
  page: CursorPageModel;
}

export type CollectionMatchedItemFiltersApiModel = Omit<CollectionItemFiltersApiModel, 'orderBy' | 'orderDirection'>;

export interface CollectionMatchedItemsApiRequestModel {
  identities: ExternalItemIdentityModel[];
  cursor?: string;
  limit?: number;
  filters?: CollectionMatchedItemFiltersApiModel;
}

export interface CollectionItemSuggestionApiModel {
  label: string;
  value: string;
  kind: 'title' | 'tag' | 'genre' | 'actor' | 'imdbId';
}

export interface CollectionItemSuggestionsApiResponseModel {
  suggestions: CollectionItemSuggestionApiModel[];
}

export interface TagSuggestionsApiResponseModel {
  tags: string[];
}

export interface GenreSuggestionsApiResponseModel {
  genres: string[];
}

export interface CollectionItemExistsApiResponseModel {
  exists: boolean;
  hash?: string;
}

export type CollectionItemExternalIdentityApiModel = ExternalItemIdentityModel;

export interface RandomImagesApiResponseModel {
  images: string[];
}

export interface CollectionStatisticsApiResponseModel {
  totalItems: number;
  movieCount: number;
  seriesCount: number;
  booksCount: number;
  favoriteCount: number;
  upNextCount: number;
  wishlistCount: number;
  watchedMovieCount: number;
  watchedSeriesCount: number;
  unwatchedMovieCount: number;
  unwatchedLibrarySeriesCount: number;
  unwatchedTrackerSeriesCount: number;
  completedTrackerSeriesCount: number;
  watchedYearCounts: Array<{ year: string; movieCount: number; seriesCount: number; count: number }>;
  tagCounts: Array<{ tag: string; count: number }>;
  genreCounts: Array<{ genre: string; count: number }>;
}

export type CollectionItemChangeApiModel = Pick<
  CollectionItemModel,
  | 'image'
  | 'title'
  | 'genre'
  | 'IMDbId'
  | 'externalProvider'
  | 'externalItemId'
  | 'externalIds'
  | 'tags'
  | 'year'
  | 'rate'
  | 'rottenTomatoesRate'
  | 'metacriticRate'
  | 'userRate'
  | 'actors'
  | 'plot'
  | 'contentType'
  | 'favorite'
  | 'progressCurrent'
  | 'progressTotal'
>;

export interface CreateApiRequestModel extends CollectionItemChangeApiModel {
  listType?: CollectionListTypeModel;
  targetOwnerShareCode?: string;
}

export interface CreateApiResponseModel {
  item: CollectionItemApiModel;
}

export interface ChangeApiRequestModel extends CollectionItemChangeApiModel {
  hash: string;
}

export interface ChangeApiResponseModel {
  item: CollectionItemApiModel;
}

export interface RefreshImagesApiResponseModel {
  count: number;
  checked: number;
  fixed: number;
  errors: number;
}

export interface RefreshExternalRatingsApiResponseModel {
  count: number;
  checked: number;
  fixed: number;
  errors: number;
}
