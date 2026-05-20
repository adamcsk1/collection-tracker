import { LanguageModel } from '@shared/models/language-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface MainState {
  clearLocalStorageAfterLogout: boolean;
  animatedBackground: boolean;
  sensitiveDataStorage: 'local' | 'session';
  language: LanguageModel;
  aiAvailable: boolean;
  defaultLibraryOwnerShareCode: string | null;
}

export const initialMainState: MainState = {
  clearLocalStorageAfterLogout: false,
  animatedBackground: true,
  sensitiveDataStorage: 'local',
  language: 'en',
  aiAvailable: false,
  defaultLibraryOwnerShareCode: null,
};

export const mainStateToken = createInjectionToken<MainState>('mainState');
