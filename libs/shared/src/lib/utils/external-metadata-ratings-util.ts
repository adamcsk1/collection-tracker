import { ExternalMetadataRatingModel } from '../models/external-metadata-model';

export const getExternalMetadataRating = (ratings: ExternalMetadataRatingModel[], source: string): string => {
  return ratings.find((rating) => rating.source === source)?.value ?? '';
};
