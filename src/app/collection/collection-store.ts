import { createInjectionToken } from 'ngx-simple-signal-store';
import { CollectionItemModel } from './collection-model';

export interface CollectionState {
  searchText: string;
  openedCollectionItem: CollectionItemModel | null;
}

export const initialCollectionState: CollectionState = {
  searchText: '',
  openedCollectionItem: null,
};

export const collectionStateToken = createInjectionToken<CollectionState>('collectionState');
