import { CollectionModel } from '../collection/collection-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface MainCollectionState {
  collection: CollectionModel;
  reloadTrigger: number;
}

export const initialMainCollectionState: MainCollectionState = {
  collection: [],
  reloadTrigger: 0,
};

export const mainCollectionStateToken = createInjectionToken<MainCollectionState>('mainCollectionState');
