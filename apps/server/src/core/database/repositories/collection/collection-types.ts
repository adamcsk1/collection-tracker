import {
  CollectionItemContentTypeModel,
  CollectionItemFiltersApiModel,
  CollectionItemOrderBy,
  CollectionItemOrderDirection,
  CollectionListTypeModel,
} from '@shared/models/api-model';

export interface CollectionItemRow {
  id: number;
  username_hash: string;
  imdb_id: string;
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
}

export interface CollectionItemQueryOptions {
  filters?: CollectionItemFiltersApiModel;
  offset: number;
  limit: number;
  matchedImdbIds?: string[];
  viewerUsernameHash?: string;
}

export interface CollectionItemOrderOptions {
  orderBy?: CollectionItemOrderBy;
  orderDirection?: CollectionItemOrderDirection;
}

export interface QueryParts {
  where: string[];
  params: Array<string | number>;
}
