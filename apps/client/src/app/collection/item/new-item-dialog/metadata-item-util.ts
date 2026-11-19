import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { ExternalMetadataItemModel } from '@shared/models/external-metadata-model';
import { getImdbIdFromExternalMetadata } from '@shared/utils/external-metadata-identity-util';
import { getExternalMetadataRating } from '@shared/utils/external-metadata-ratings-util';

export const buildMetadataItem = (metadata: ExternalMetadataItemModel): CollectionItemChangeApiModel => {
  const year = metadata.year
    .trim()
    .replace('–', '-')
    .replace(/^(\d{4})\.0$/, '$1');
  return {
    image: metadata.poster,
    title: metadata.title,
    genre: metadata.genres,
    IMDbId: getImdbIdFromExternalMetadata(metadata),
    externalProvider: metadata.provider,
    externalItemId: metadata.providerItemId,
    externalIds: metadata.externalIds,
    tags: [],
    year: year && year !== 'N/A' ? year : null,
    rate: getExternalMetadataRating(metadata.ratings, 'Internet Movie Database'),
    rottenTomatoesRate: getExternalMetadataRating(metadata.ratings, 'Rotten Tomatoes'),
    metacriticRate: getExternalMetadataRating(metadata.ratings, 'Metacritic'),
    userRate: null,
    actors: metadata.actors,
    plot: metadata.plot,
    contentType: metadata.contentType,
    favorite: false,
  };
};
