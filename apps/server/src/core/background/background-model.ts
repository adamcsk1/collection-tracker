export type BackgroundIdentityKind = 'imdb' | 'isbn' | 'mbid';

export interface BackgroundIdentity {
  kind: BackgroundIdentityKind;
  id: string;
}

export interface BackgroundConfig {
  imdbIds: string[];
  isbnIds?: string[];
  mbids?: string[];
  posters?: Record<string, string>;
}
