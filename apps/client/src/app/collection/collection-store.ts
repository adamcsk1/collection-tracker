import { createInjectionToken } from 'ngx-simple-signal-store';

export interface CollectionState {
  searchText: string;
  forceStandardSearch: boolean;
}

export const initialCollectionState: CollectionState = {
  searchText: '',
  forceStandardSearch: false,
};

export const collectionStateToken = createInjectionToken<CollectionState>('collectionState');
