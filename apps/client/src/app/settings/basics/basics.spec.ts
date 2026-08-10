import { TestBed } from '@angular/core/testing';
import { initialMainState, mainStateToken, type MainState } from '../../main/main-store';
import { SettingsBasics } from './basics';
import { SettingsService } from '../settings-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ThemeService } from '@services/theme/theme-service';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SettingsBasics component', () => {
  let component: SettingsBasics;
  let settingsService: { storeFormData: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<MainState>;

  beforeEach(() => {
    settingsService = { storeFormData: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SettingsBasics],
      providers: [
        { provide: SettingsService, useValue: settingsService },
        { provide: ThemeService, useValue: { themeOptions: () => ['light', 'dark'] } },
        { provide: TranslateService, useValue: { languageOptions: () => ['en', 'de'], setLanguage: vi.fn() } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialThemeState, themeStateToken),
        provideStore(initialApiState, apiStateToken),
      ],
    });

    const fixture = TestBed.createComponent(SettingsBasics);
    component = fixture.componentInstance;
    mainState = TestBed.inject(mainStateToken);
    fixture.detectChanges();
  });

  it('does not save settings while initializing from state', () => {
    expect(settingsService.storeFormData).not.toHaveBeenCalled();
  });

  it('exposes translated labels and configured form options', () => {
    expect(component['translations'].language()).toBe('Language');
    expect(component['translations'].theme()).toBe('Theme');
    expect(component['translations'].sensitiveDataStorage()).toBe('SensitiveDataStorage');
    expect(component['translations'].clearLocalStorageAfterLogout()).toBe('ClearLocalStorageAfterLogout');
    expect(component['themeOptions']()).toEqual(['light', 'dark']);
    expect(component['languageOptions']()).toEqual(['en', 'de']);
  });

  it('stores form data when a setting changes', () => {
    component['onThemeChange']('dark');

    expect(settingsService.storeFormData).toHaveBeenCalledWith({
      sensitiveDataStorage: 'local',
      theme: 'dark',
      clearLocalStorageAfterLogout: false,
      animatedBackground: true,
      language: 'en',
    });
  });

  it('ignores invalid select values', () => {
    component['onThemeChange']('unknown');

    expect(settingsService.storeFormData).not.toHaveBeenCalled();
  });

  it('stores valid language and ignores invalid language', () => {
    component['onLanguageChange']('en');
    expect(settingsService.storeFormData).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));

    settingsService.storeFormData.mockClear();
    component['onLanguageChange']('unknown');
    expect(settingsService.storeFormData).not.toHaveBeenCalled();
  });

  it('stores boolean animated background and ignores non-booleans', () => {
    component['onAnimatedBackgroundChange'](false);
    expect(settingsService.storeFormData).toHaveBeenCalledWith(expect.objectContaining({ animatedBackground: false }));

    settingsService.storeFormData.mockClear();
    component['onAnimatedBackgroundChange'](null);
    expect(settingsService.storeFormData).not.toHaveBeenCalled();
  });

  it('stores valid sensitive storage and ignores invalid storage', () => {
    component['onSensitiveDataStorageChange']('session');
    expect(settingsService.storeFormData).toHaveBeenCalledWith(
      expect.objectContaining({ sensitiveDataStorage: 'session' })
    );

    settingsService.storeFormData.mockClear();
    component['onSensitiveDataStorageChange']('unknown');
    expect(settingsService.storeFormData).not.toHaveBeenCalled();
  });

  it('stores boolean logout clearing and ignores non-booleans', () => {
    component['onClearLocalStorageAfterLogoutChange'](true);
    expect(settingsService.storeFormData).toHaveBeenCalledWith(
      expect.objectContaining({ clearLocalStorageAfterLogout: true })
    );

    settingsService.storeFormData.mockClear();
    component['onClearLocalStorageAfterLogoutChange'](null);
    expect(settingsService.storeFormData).not.toHaveBeenCalled();
  });

  it('refreshes background images without storing settings', () => {
    component['onRefreshBackgroundImages']();

    expect(mainState.state.backgroundImagesRefreshTrigger()).toBe(1);
    expect(settingsService.storeFormData).not.toHaveBeenCalled();
  });
});
