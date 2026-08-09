import type { CollectionItemContentTypeModel, CollectionListTypeModel } from './collection-item-model';

export type SharePermission = 'read' | 'create' | 'update' | 'delete';

export interface ShareScope {
  listType: CollectionListTypeModel;
  contentType: CollectionItemContentTypeModel;
}
