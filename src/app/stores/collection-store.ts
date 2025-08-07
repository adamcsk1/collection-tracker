import { CollectionModel } from '@pages/collection/collection.model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface CollectionState {
  collection: CollectionModel;
}

export const initialCollectionState: CollectionState = {
  collection: [],
};

export const collectionStateToken = createInjectionToken<CollectionState>('collectionState');
