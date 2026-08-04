import { ExternalItemIdentityModel, ExternalMetadataProviderNameModel } from './external-metadata-provider-model';

export type CollectionListTypeModel = 'library' | 'watchlist' | 'wishlist' | 'tracking' | 'finished' | 'books';
export type CollectionItemContentTypeModel = 'movie' | 'series' | 'book';
export type CollectionItemYearModel = string | null;

export interface CollectionItemModel {
  image: string;
  title: string;
  titleLower: string; // The lowercase cached version of title for faster searching.
  genre: string[];
  IMDbId?: string;
  externalProvider: ExternalMetadataProviderNameModel;
  externalItemId: string;
  externalIds?: ExternalItemIdentityModel[];
  canonicalItemId?: string;
  tags: string[];
  year: CollectionItemYearModel;
  rate: string;
  rottenTomatoesRate: string;
  metacriticRate: string;
  userRate: number | null;
  hash: string;
  actors: string;
  plot: string;
  listType: CollectionListTypeModel;
  contentType: CollectionItemContentTypeModel;
  favorite: boolean;
  watched?: boolean;
  watchedAt: string | null;
  progressCurrent?: number | null;
  progressTotal?: number | null;
  ownerShareCode?: string;
}

export type CollectionModel = CollectionItemModel[];
