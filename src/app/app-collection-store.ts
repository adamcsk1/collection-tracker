import { createInjectionToken } from 'ngx-simple-signal-store';
import { CollectionModel } from './collection/collection-model';

export interface AppCollectionState {
  collection: CollectionModel;
}

export const initialAppCollectionState: AppCollectionState = {
  collection: [],
};

export const appCollectionStateToken = createInjectionToken<AppCollectionState>('appCollectionState');
