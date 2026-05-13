import { TestBed } from '@angular/core/testing';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { SettingsBasics } from './basics';
import { SettingsService } from '../settings-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ThemeService } from '@services/theme/theme-service';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SettingsBasics component', () => {
  let component: SettingsBasics;
  let settingsService: { storeFormData: ReturnType<typeof vi.fn> };

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
    fixture.detectChanges();
  });

  it('does not save settings while initializing from state', () => {
    expect(settingsService.storeFormData).not.toHaveBeenCalled();
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
});
