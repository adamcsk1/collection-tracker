interface OMDbResponseRatingModel {
  Source?: unknown;
  Value?: unknown;
}

export interface OmdbSeriesInfoResponse {
  totalSeasons?: string;
}

export interface OmdbSeasonResponse {
  Episodes?: Array<{ Title?: string }>;
}

export interface OmdbErrorResponse {
  error: string;
}

export interface OMDbResponseItemModel {
  Error?: string;
  Response?: string;
  imdbID?: unknown;
  imdbRating?: unknown;
  Ratings?: OMDbResponseRatingModel[];
  Plot?: unknown;
  Poster?: unknown;
  Type?: unknown;
  Title?: unknown;
  Year?: unknown;
  Director?: unknown;
  Genre?: unknown;
  Actors?: unknown;
  totalSeasons?: unknown;
}

export interface OMDbResponseModel {
  Error?: string;
  Response?: string;
  Search?: OMDbResponseItemModel[];
}
