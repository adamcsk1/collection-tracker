export interface OMDbResponseItemModel {
  imdbID: string;
  imdbRating: string;
  Plot: string;
  Poster: string;
  Type: string;
  Title: string;
  Year: string;
  Director: string;
  Genre: string;
  Actors: string;
}

export interface OMDbResponseModel {
  Search: OMDbResponseItemModel[];
}
