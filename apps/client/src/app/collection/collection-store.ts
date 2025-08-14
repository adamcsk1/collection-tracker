import { createInjectionToken } from 'ngx-simple-signal-store';

export interface CollectionState {
  searchText: string;
}

export const initialCollectionState: CollectionState = {
  searchText: '',
};

export const collectionStateToken = createInjectionToken<CollectionState>('collectionState');
