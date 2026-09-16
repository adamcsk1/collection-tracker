interface OMDbResponseRatingModel {
  Source?: string;
  Value?: string;
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
  imdbID?: string;
  imdbRating?: string;
  Ratings?: OMDbResponseRatingModel[];
  Plot?: string;
  Poster?: string;
  Type?: string;
  Title?: string;
  Year?: string;
  Director?: string;
  Genre?: string;
  Actors?: string;
  totalSeasons?: string;
}

export interface OMDbResponseModel {
  Error?: string;
  Response?: string;
  Search?: OMDbResponseItemModel[];
}
