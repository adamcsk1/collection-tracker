import { LanguageModel } from '@shared/models/language-model';
import {
  CollectionListDisplayPreferencesModel,
  DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES,
} from '@shared/models/collection-list-display-preferences-model';
import { createInjectionToken } from 'ngx-simple-signal-store';
import { CollectionFeaturePreferencesModel } from '@shared/models/collection-feature-preferences-model';
import { DEFAULT_COLLECTION_FEATURE_PREFERENCES } from '@shared/constants/collection-feature-preferences-const';
import { CollectionOwnerDefaultModel } from '@shared/models/api-model';

export interface MainState {
  clearLocalStorageAfterLogout: boolean;
  animatedBackground: boolean;
  sensitiveDataStorage: 'local' | 'session';
  language: LanguageModel;
  aiAvailable: boolean;
  backgroundImagesRefreshTrigger: number;
  defaultCollectionOwners: CollectionOwnerDefaultModel[];
  collectionListDisplayPreferences: CollectionListDisplayPreferencesModel;
  collectionFeaturePreferences: CollectionFeaturePreferencesModel;
}

export const initialMainState: MainState = {
  clearLocalStorageAfterLogout: false,
  animatedBackground: true,
  sensitiveDataStorage: 'local',
  language: 'en',
  aiAvailable: false,
  backgroundImagesRefreshTrigger: 0,
  defaultCollectionOwners: [],
  collectionListDisplayPreferences: DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES,
  collectionFeaturePreferences: DEFAULT_COLLECTION_FEATURE_PREFERENCES,
};

export const mainStateToken = createInjectionToken<MainState>('mainState');
