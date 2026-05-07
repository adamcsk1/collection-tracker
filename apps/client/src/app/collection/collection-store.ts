import { createInjectionToken } from 'ngx-simple-signal-store';

export interface CollectionState {
  searchText: string;
  aiSearchPromptText: string;
  aiSearchSendVersion: number;
  forceStandardSearch: boolean;
}

export const initialCollectionState: CollectionState = {
  searchText: '',
  aiSearchPromptText: '',
  aiSearchSendVersion: 0,
  forceStandardSearch: false,
};

export const collectionStateToken = createInjectionToken<CollectionState>('collectionState');
