import { ExternalMetadataRatingModel } from '../models/external-metadata-model';

const imdbRatingWithDenominatorPattern = /^(?<rating>10(?:\.0)?|[0-9](?:\.[0-9])?)\/10$/;

export const normalizeIMDbRating = (rating: string): string => {
  return imdbRatingWithDenominatorPattern.exec(rating.trim())?.groups?.['rating'] ?? rating;
};

export const getExternalMetadataRating = (ratings: ExternalMetadataRatingModel[], source: string): string => {
  const rating = ratings.find((rating) => rating.source === source)?.value ?? '';
  return source === 'Internet Movie Database' ? normalizeIMDbRating(rating) : rating;
};
