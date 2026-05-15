import { CollectionItemModel, CollectionListTypeModel } from './collection-item-model';
import { LanguageModel } from './language-model';
import { ThemeModel } from './theme-model';

export type { CollectionListTypeModel } from './collection-item-model';

export type CollectionItemApiModel = CollectionItemModel;

export type CollectionItemTypeFilter = 'movie' | 'series';
export type CollectionItemTagMode = 'any' | 'all';

export interface CollectionItemFiltersApiModel {
  search?: string;
  tags?: string[];
  genres?: string[];
  tagMode?: CollectionItemTagMode;
  type?: CollectionItemTypeFilter;
  watched?: boolean;
  listType?: CollectionListTypeModel;
}

export interface CollectionItemsApiResponseModel {
  items: CollectionItemApiModel[];
  total: number;
  offset: number;
  limit: number;
}

export interface CollectionMatchedItemsApiRequestModel {
  imdbIds: string[];
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
}

export interface RandomImagesApiResponseModel {
  images: string[];
}

export interface CollectionStatisticsApiResponseModel {
  totalItems: number;
  movieCount: number;
  seriesCount: number;
  favoriteCount: number;
  watchLaterCount: number;
  wishlistCount: number;
  watchedCount: number;
  unwatchedCount: number;
  tagCounts: Array<{ tag: string; count: number }>;
  genreCounts: Array<{ genre: string; count: number }>;
}

export type CollectionItemChangeApiModel = Pick<
  CollectionItemModel,
  'image' | 'title' | 'genre' | 'IMDbId' | 'tags' | 'year' | 'rate' | 'userRate' | 'actors' | 'plot'
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
}

export interface AiAvailableApiResponseModel {
  aiAvailable: boolean;
}

export interface UserSettingsApiRequestModel extends UserSettingsApiResponseModel {
  fromLogin?: boolean; // To initialize language and theme after first login, as the client won't have the user settings yet.
}

export interface TagConfigApiModel {
  tag: string;
  color: string | null;
  useForImageBorder: boolean;
  useForTextColor: boolean;
  useForImageBadge: boolean;
  weight: number;
}

export type TagConfigsApiResponseModel = TagConfigApiModel[];
export type TagConfigsApiRequestModel = TagConfigsApiResponseModel;

export interface MarkAllWatchedApiResponseModel {
  changedCount: number;
}

export interface MarkAllUnwatchedApiResponseModel {
  changedCount: number;
}

export interface RefreshImagesApiResponseModel {
  count: number;
  checked: number;
  fixed: number;
  errors: number;
}

export interface UserShareOutgoingApiModel {
  sharedWithUserShareCode: string;
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
