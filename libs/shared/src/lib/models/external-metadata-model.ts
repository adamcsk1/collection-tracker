import {
  ExternalItemIdentityModel,
  ExternalItemIdentitySourceNameModel,
  ExternalMetadataProviderNameModel,
} from './external-metadata-provider-model';
import { CollectionItemContentTypeModel } from './collection-item-model';
import { SelectDataModel } from './select-model';

export interface ExternalMetadataRatingModel {
  source: string;
  value: string;
}

export interface ExternalMetadataReferenceModel {
  identitySource: ExternalItemIdentitySourceNameModel;
  identityId: string;
  externalIds?: ExternalItemIdentityModel[];
}

export interface ExternalMetadataItemModel {
  provider: ExternalMetadataProviderNameModel;
  providerItemId: string;
  externalIds?: ExternalItemIdentityModel[];
  title: string;
  year: string;
  contentType: CollectionItemContentTypeModel;
  poster: string;
  plot: string;
  actors: string;
  genres: string[];
  ratings: ExternalMetadataRatingModel[];
}

export interface ExternalMetadataSearchResponseModel {
  results: ExternalMetadataItemModel[];
}

export interface ExternalMetadataSelectDataModel extends SelectDataModel {
  contentType?: CollectionItemContentTypeModel;
  poster?: string;
  year?: string;
}

export interface ExternalMetadataProviderModel {
  name: ExternalMetadataProviderNameModel;
  supportsSeasonMetadata: boolean;
  supportsDirectImdbId: boolean;
}

export interface ExternalMetadataProvidersResponseModel {
  providers: ExternalMetadataProviderModel[];
}
