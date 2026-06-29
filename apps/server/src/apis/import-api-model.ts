import { EXPORT_VERSION } from '@shared/constants/export-import-const';
import { CollectionItemApiModel, UserImportApiRequestModel } from '@shared/models/api-model';
import { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';

export type ImportedCollectionItemApiModel = Omit<CollectionItemApiModel, 'externalIds'> & {
  externalIds?: ExternalItemIdentityModel[];
};

export type ImportedUserRequestModel = Omit<UserImportApiRequestModel, 'version' | 'collectionItems'> & {
  version: typeof EXPORT_VERSION;
  collectionItems: ImportedCollectionItemApiModel[];
};
