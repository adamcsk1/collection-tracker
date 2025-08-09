import { CollectionModel } from '@collection/collection-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface AppCollectionState {
  collection: CollectionModel;
}

export const initialAppCollectionState: AppCollectionState = {
  collection: [],
};

export const appCollectionStateToken = createInjectionToken<AppCollectionState>('appCollectionState');
