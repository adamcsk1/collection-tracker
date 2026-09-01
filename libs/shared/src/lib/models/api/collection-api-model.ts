import type { CursorPageModel } from '../api-envelope-model';
import type { CollectionItemModel, CollectionListTypeModel } from '../collection-item-model';
import type { ExternalItemIdentityModel } from '../external-metadata-provider-model';

export type CollectionItemApiModel = CollectionItemModel & Required<Pick<CollectionItemModel, 'ownerShareCode'>>;

export type CollectionItemTypeFilter = 'movie' | 'series' | 'book';
export type CollectionItemTagMode = 'any' | 'all';
export type CollectionItemOrderBy = 'createdAt' | 'alphabet';
export type CollectionItemOrderDirection = 'asc' | 'desc';

export type CollectionItemSharedFilter = 'mine' | 'shared';

export type MovieCollectionStatisticsStatus = 'watched' | 'unwatched';
export type SeriesCollectionStatisticsStatus = 'untracked' | 'completed' | 'inProgress';
export type BookCollectionStatisticsStatus = 'read' | 'unread' | 'inProgress';
export type CollectionStatisticsStatus =
  MovieCollectionStatisticsStatus | SeriesCollectionStatisticsStatus | BookCollectionStatisticsStatus;

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

export interface BackgroundImagesApiResponseModel {
  images: string[];
}

export interface CommonCollectionStatisticsChartsApiModel {
  tagCounts: Array<{ tag: string; count: number }>;
  genreCounts: Array<{ genre: string; count: number }>;
  releaseYearCounts: Array<{ year: string; count: number }>;
  userRatingCounts: Array<{ rating: number; count: number }>;
}

export interface AllCollectionStatisticsChartsApiModel extends CommonCollectionStatisticsChartsApiModel {
  mediaTypeCounts: Array<{ type: CollectionItemTypeFilter; count: number }>;
  statusCounts: [];
}

export interface MovieCollectionStatisticsChartsApiModel extends CommonCollectionStatisticsChartsApiModel {
  mediaTypeCounts: [];
  statusCounts: Array<{ status: MovieCollectionStatisticsStatus; count: number }>;
}

export interface SeriesCollectionStatisticsChartsApiModel extends CommonCollectionStatisticsChartsApiModel {
  mediaTypeCounts: [];
  statusCounts: Array<{ status: SeriesCollectionStatisticsStatus; count: number }>;
}

export interface BookCollectionStatisticsChartsApiModel extends CommonCollectionStatisticsChartsApiModel {
  mediaTypeCounts: [];
  statusCounts: Array<{ status: BookCollectionStatisticsStatus; count: number }>;
}

export interface AllCollectionStatisticsSummaryApiModel {
  total: number;
  movies: number;
  series: number;
  books: number;
  favorites: number;
}

export interface MovieCollectionStatisticsSummaryApiModel {
  total: number;
  favorites: number;
  watched: number;
  unwatched: number;
}

export interface SeriesCollectionStatisticsSummaryApiModel {
  total: number;
  favorites: number;
  tracked: number;
  untracked: number;
  completed: number;
  inProgress: number;
}

export interface BookCollectionStatisticsSummaryApiModel {
  total: number;
  favorites: number;
  read: number;
  unread: number;
  inProgress: number;
}

export type CollectionStatisticsApiResponseModel =
  | { scope: 'all'; summary: AllCollectionStatisticsSummaryApiModel; charts: AllCollectionStatisticsChartsApiModel }
  | {
      scope: 'movie';
      summary: MovieCollectionStatisticsSummaryApiModel;
      charts: MovieCollectionStatisticsChartsApiModel;
    }
  | {
      scope: 'series';
      summary: SeriesCollectionStatisticsSummaryApiModel;
      charts: SeriesCollectionStatisticsChartsApiModel;
    }
  | { scope: 'book'; summary: BookCollectionStatisticsSummaryApiModel; charts: BookCollectionStatisticsChartsApiModel };

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
