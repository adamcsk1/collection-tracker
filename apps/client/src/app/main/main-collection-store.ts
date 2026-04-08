import { CollectionModel } from '../collection/collection-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface MainCollectionState {
  collection: CollectionModel;
}

export const initialMainCollectionState: MainCollectionState = {
  collection: [],
};

export const mainCollectionStateToken = createInjectionToken<MainCollectionState>('mainCollectionState');
