import {
  CollectionItemApiModel,
  CollectionItemContentTypeModel,
  CollectionItemFiltersApiModel,
  CollectionItemOrderBy,
  CollectionItemOrderDirection,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';

export interface CollectionItemRow {
  id: number;
  username_hash: string;
  imdb_id: string | null;
  external_provider: string;
  external_item_id: string | null;
  canonical_item_id: string | null;
  list_type: CollectionListTypeModel;
  content_type: CollectionItemContentTypeModel;
  favorite: 0 | 1;
  title: string;
  title_lower: string;
  year: string;
  rate: string;
  rotten_tomatoes_rate: string;
  metacritic_rate: string;
  user_rate: number | null;
  actors: string;
  plot: string;
  image: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
  watched_at: string | null;
  progress_current: number | null;
  progress_total: number | null;
}

export const collectionItemProjection = (alias = 'collection_items'): string => `${alias}.id,
  ${alias}.username_hash,
  COALESCE(
    CASE
      WHEN ${alias}.external_provider IN ('imdb', 'omdb')
        AND LOWER(${alias}.external_item_id) GLOB 'tt[0-9]*'
        AND LOWER(SUBSTR(${alias}.external_item_id, 3)) NOT GLOB '*[^0-9]*'
      THEN LOWER(${alias}.external_item_id)
    END,
    (
      SELECT imdb_identity.external_item_id
      FROM external_item_identities imdb_identity
      WHERE imdb_identity.username_hash = ${alias}.username_hash
        AND imdb_identity.canonical_item_id = ${alias}.canonical_item_id
        AND imdb_identity.external_provider = 'imdb'
      ORDER BY imdb_identity.source_confidence = 'primary' DESC, imdb_identity.created_at, imdb_identity.external_item_id
      LIMIT 1
    )
  ) AS imdb_id,
  ${alias}.external_provider,
  ${alias}.external_item_id,
  ${alias}.canonical_item_id,
  ${alias}.list_type,
  ${alias}.content_type,
  ${alias}.favorite,
  ${alias}.title,
  ${alias}.title_lower,
  ${alias}.year,
  COALESCE((SELECT value FROM collection_item_external_ratings WHERE item_id = ${alias}.id AND source = 'imdb'), '') AS rate,
  COALESCE((SELECT value FROM collection_item_external_ratings WHERE item_id = ${alias}.id AND source = 'rotten-tomatoes'), '') AS rotten_tomatoes_rate,
  COALESCE((SELECT value FROM collection_item_external_ratings WHERE item_id = ${alias}.id AND source = 'metacritic'), '') AS metacritic_rate,
  ${alias}.user_rate,
  ${alias}.contributors AS actors,
  ${alias}.description AS plot,
  ${alias}.image,
  ${alias}.content_hash,
  ${alias}.created_at,
  ${alias}.updated_at,
  (SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ${alias}.id) AS watched_at,
  (SELECT progress_current FROM collection_item_tracker_state WHERE item_id = ${alias}.id) AS progress_current,
  (SELECT progress_total FROM collection_item_tracker_state WHERE item_id = ${alias}.id) AS progress_total`;

export type AiSearchWatchStatus = 'completed' | 'unfinished' | 'watched' | 'unwatched' | 'not-applicable';

export interface AiSearchCollectionItem extends CollectionItemApiModel {
  itemId: number;
  aiSearchContentHash: string;
  aiSearchText: string;
  completed: boolean | null;
  watchStatus: AiSearchWatchStatus;
  completedEpisodes: number | null;
  totalEpisodes: number | null;
  progressPercent: number | null;
}

export interface CollectionItemQueryOptions {
  filters?: CollectionItemFiltersApiModel;
  offset: number;
  limit: number;
  matchedIdentities?: ExternalItemIdentityModel[];
  matchedCanonicalItemIds?: string[];
}

export interface CollectionItemOrderOptions {
  orderBy?: CollectionItemOrderBy;
  orderDirection?: CollectionItemOrderDirection;
}

export interface QueryParts {
  where: string[];
  params: Array<string | number>;
}

export interface WatchedYearCountRow {
  watched_year: string;
  count: number;
}
