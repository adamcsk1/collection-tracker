import { createInjectionToken } from 'ngx-simple-signal-store';

export interface CollectionState {
  searchText: string;
  claudeAiPromptText: string;
  claudeAiSendVersion: number;
  forceStandardSearch: boolean;
}

export const initialCollectionState: CollectionState = {
  searchText: '',
  claudeAiPromptText: '',
  claudeAiSendVersion: 0,
  forceStandardSearch: false,
};

export const collectionStateToken = createInjectionToken<CollectionState>('collectionState');
