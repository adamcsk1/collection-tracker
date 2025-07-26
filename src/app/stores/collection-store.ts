import { CollectionModel } from '@pages/collection/collection.model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface CollectionState {
  collection: CollectionModel;
  loadNetworkStatus: 'pending' | 'error' | 'finished' | null;
}

export const initialCollectionState: CollectionState = {
  collection: [],
  loadNetworkStatus: null,
};

export const collectionStateToken = createInjectionToken<CollectionState>('collectionState');
