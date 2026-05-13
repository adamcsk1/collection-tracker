import { LanguageModel } from '@shared/models/language-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface MainState {
  clearLocalStorageAfterLogout: boolean;
  animatedBackground: boolean;
  sensitiveDataStorage: 'local' | 'session';
  language: LanguageModel;
  aiAvailable: boolean;
}

export const initialMainState: MainState = {
  clearLocalStorageAfterLogout: false,
  animatedBackground: true,
  sensitiveDataStorage: 'local',
  language: 'en',
  aiAvailable: false,
};

export const mainStateToken = createInjectionToken<MainState>('mainState');
