import { createInjectionToken } from 'ngx-simple-signal-store';
import { CollectionItemModel } from './collection.model';

export interface ComponentCollectionState {
  searchText: string;
  openedCollectionItem: CollectionItemModel | null;
}

export const initialComponentCollectionState: ComponentCollectionState = {
  searchText: '',
  openedCollectionItem: null,
};

export const componentCollectionStateToken = createInjectionToken<ComponentCollectionState>('componentCollectionState');
