import { LanguageModel } from '@shared/models/language-model';
import {
  CollectionListDisplayPreferencesModel,
  DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES,
} from '@shared/models/collection-list-display-preferences-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface MainState {
  clearLocalStorageAfterLogout: boolean;
  animatedBackground: boolean;
  sensitiveDataStorage: 'local' | 'session';
  language: LanguageModel;
  aiAvailable: boolean;
  backgroundImagesRefreshTrigger: number;
  defaultLibraryOwnerShareCode: string | null;
  collectionListDisplayPreferences: CollectionListDisplayPreferencesModel;
}

export const initialMainState: MainState = {
  clearLocalStorageAfterLogout: false,
  animatedBackground: true,
  sensitiveDataStorage: 'local',
  language: 'en',
  aiAvailable: false,
  backgroundImagesRefreshTrigger: 0,
  defaultLibraryOwnerShareCode: null,
  collectionListDisplayPreferences: DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES,
};

export const mainStateToken = createInjectionToken<MainState>('mainState');
