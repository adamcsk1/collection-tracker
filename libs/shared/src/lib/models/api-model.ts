import { ExternalItemIdentityModel } from './external-metadata-provider-model';
import { CollectionItemModel, CollectionListTypeModel } from './collection-item-model';
import { CollectionListDisplayPreferencesModel } from './collection-list-display-preferences-model';
import { CollectionFeaturePreferencesModel } from './collection-feature-preferences-model';
import { LanguageModel } from './language-model';
import { ThemeModel } from './theme-model';

export type { CollectionItemContentTypeModel, CollectionListTypeModel } from './collection-item-model';

export type CollectionItemApiModel = CollectionItemModel;

export type CollectionItemTypeFilter = 'movie' | 'series' | 'book';
export type CollectionItemTagMode = 'any' | 'all';
export type CollectionItemOrderBy = 'createdAt' | 'alphabet';
export type CollectionItemOrderDirection = 'asc' | 'desc';

export interface CollectionItemFiltersApiModel {
  search?: string;
  tags?: string[];
  genres?: string[];
  tagMode?: CollectionItemTagMode;
  type?: CollectionItemTypeFilter;
  watched?: boolean;
  completed?: boolean;
  favorite?: boolean;
  listType?: CollectionListTypeModel;
  orderBy?: CollectionItemOrderBy;
  orderDirection?: CollectionItemOrderDirection;
}

export interface CollectionItemsApiResponseModel {
  items: CollectionItemApiModel[];
  total: number;
  offset: number;
  limit: number;
}

export interface CollectionMatchedItemsApiRequestModel {
  identities: ExternalItemIdentityModel[];
  offset?: number;
  limit?: number;
  filters?: CollectionItemFiltersApiModel;
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
  watchlistCount: number;
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

export interface ChangeTokenApiResponseModel {
  newToken: string;
}

export interface SignInApiRequestModel {
  username: string;
  token: string;
}

export interface SignUpApiRequestModel {
  username: string;
}

export interface SignUpApiResponseModel {
  token: string;
}

export interface AccessTokenModel {
  tokenHash: string;
  createdAt: string;
  userAgent: string;
  expiresAt: string | null;
}

export interface RefreshTokenModel {
  tokenHash: string;
  createdAt: string;
  userAgent: string;
  expiresAt: string | null;
}

export type AccessTokensApiResponseModel = AccessTokenModel[];

export interface CreateAccessTokenApiResponseModel {
  accessToken: string;
}

export interface UserSettingsApiResponseModel {
  theme?: ThemeModel;
  animatedBackground?: boolean;
  language?: LanguageModel;
  defaultLibraryOwnerShareCode?: string | null;
  collectionListDisplayPreferences?: CollectionListDisplayPreferencesModel;
  collectionFeaturePreferences?: CollectionFeaturePreferencesModel;
}

export interface AiAvailableApiResponseModel {
  aiAvailable: boolean;
}

export interface UserSettingsApiRequestModel extends UserSettingsApiResponseModel {
  fromLogin?: boolean; // To initialize language and theme after first login, as the client won't have the user settings yet.
}

export interface TagManagementApiModel {
  tag: string;
  color: string | null;
  useForImageBorder: boolean;
  useForTextColor: boolean;
  useForImageBadge: boolean;
  weight: number;
}

export type TagManagementApiResponseModel = TagManagementApiModel[];
export type TagManagementApiRequestModel = TagManagementApiResponseModel;

export interface RenameTagApiRequestModel {
  oldTag: string;
  newTag: string;
}

export interface RenameTagApiResponseModel {
  renamedItemCount: number;
  tagManagement: TagManagementApiResponseModel;
}

export interface MarkAllCompletedApiResponseModel {
  changedCount: number;
}

export interface MarkAllSeriesCompletedApiResponseModel {
  trackedCount: number;
  progressChangedCount: number;
}

export interface MarkAllUncompletedApiResponseModel {
  changedCount: number;
}

export interface CompletedApiResponseModel {
  item: CollectionItemApiModel;
}

export type FinishedApiResponseModel = CompletedApiResponseModel;

export interface TrackingApiResponseModel {
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

export interface TrackingSeasonMetadataModel {
  season: number;
  episodes: number;
  titles?: string[];
}

export interface TrackingSeasonsApiResponseModel {
  seasons: TrackingSeasonMetadataModel[];
  item?: CollectionItemApiModel;
}

export interface TrackingSeasonsApiRequestModel {
  seasons: TrackingSeasonMetadataModel[];
}

export interface TrackingCompletedEpisodeModel {
  season: number;
  episode: number;
}

export interface TrackingCompletedEpisodesApiResponseModel {
  completedEpisodes: TrackingCompletedEpisodeModel[];
  lastCompletedEpisode: { season: number; episode: number } | null;
  item?: CollectionItemApiModel;
}

export interface TrackingCompletedEpisodesApiRequestModel {
  completedEpisodes: TrackingCompletedEpisodeModel[];
}

export interface UserShareOutgoingApiModel {
  sharedWithUserShareCode: string;
  sharedWithUsername: string | null;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface UserShareIncomingApiModel {
  ownerUserShareCode: string;
  ownerUsername: string | null;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface UserSharesApiResponseModel {
  userShareCode: string;
  outgoing: UserShareOutgoingApiModel[];
  incoming: UserShareIncomingApiModel[];
}

export interface UserExportApiResponseModel {
  type: string;
  version: number;
  userSettings: UserSettingsApiResponseModel;
  collectionItems: CollectionItemApiModel[];
  tagManagement: TagManagementApiResponseModel;
  trackingData: Record<
    string,
    {
      seasons: TrackingSeasonMetadataModel[];
      completedEpisodes: TrackingCompletedEpisodeModel[];
    }
  >;
}

export type UserImportApiRequestModel = UserExportApiResponseModel;

export interface UserImportApiResponseModel {
  importedCollectionItems: number;
  importedTagManagement: number;
  importedTrackingSeasons: number;
  importedTrackingCompletedEpisodes: number;
}

export interface CollectionItemsImportApiRequestModel {
  source: string;
}

export interface CollectionItemsImportApiResponseModel {
  totalCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
}

export interface HealthApiResponseModel {
  status: 'ok' | 'warn' | 'error';
  memory: {
    usedPercent: number;
  };
  cpu: {
    usagePercent: number;
  };
  disk: {
    usedPercent: number;
  } | null;
  load: {
    avg1m: number;
    avg5m: number;
    avg15m: number;
  };
  frontend: {
    status: 'up' | 'down';
  };
  ai: {
    status: 'up' | 'down';
  };
}
