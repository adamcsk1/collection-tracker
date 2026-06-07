export interface OMDbResponseRatingModel {
  Source: string;
  Value: string;
}

export interface OMDbResponseItemModel {
  imdbID: string;
  imdbRating: string;
  Ratings?: OMDbResponseRatingModel[];
  Plot: string;
  Poster: string;
  Type: string;
  Title: string;
  Year: string;
  Director: string;
  Genre: string;
  Actors: string;
  totalSeasons?: string;
}

export interface OMDbResponseModel {
  Search: OMDbResponseItemModel[];
}
