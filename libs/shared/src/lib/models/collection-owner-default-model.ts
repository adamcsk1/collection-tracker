import type { CollectionItemContentTypeModel, CollectionListTypeModel } from './collection-item-model';

export interface CollectionOwnerDefaultModel {
  listType: CollectionListTypeModel;
  contentType: CollectionItemContentTypeModel;
  ownerUserShareCode: string;
}
