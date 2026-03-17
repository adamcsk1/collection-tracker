import { TestBed } from '@angular/core/testing';
import { ChangeWatchedStatusService } from '@client/settings/change-watched-status/change-watched-status-service';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { ImageRefreshService } from '@client/settings/image-refresh/image-refresh-service';
import { initialApiState, apiStateToken } from '@services/api/api-store';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { ThemeService } from '@services/theme/theme-service';
import { TranslateService } from '@services/translate-service';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Settings } from './settings';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { SettingsService } from './settings-service';

describe('Settings component', () => {
  let component: Settings;
  let changeWatchedStatus: { markAllAsWatched: ReturnType<typeof vi.fn>; markAllAsUnwatched: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    changeWatchedStatus = {
      markAllAsWatched: vi.fn(),
      markAllAsUnwatched: vi.fn(),
    };
    const imageRefresh = { refreshImages: vi.fn() };

    TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        { provide: SettingsService, useValue: { storeFormData: vi.fn() } },
        { provide: ChangeWatchedStatusService, useValue: changeWatchedStatus },
        { provide: ImageRefreshService, useValue: imageRefresh },
        { provide: ThemeService, useValue: { themeOptions: ['light', 'dark'] } },
        { provide: TranslateService, useValue: { languageOptions: ['en', 'de'], setLanguage: vi.fn() } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialThemeState, themeStateToken),
        provideStore(initialApiState, apiStateToken),
      ],
    });

    TestBed.overrideComponent(Settings, {
      set: {
        template: '',
        providers: [{ provide: ChangeWatchedStatusService, useValue: changeWatchedStatus }],
      },
    });

    const fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calls service to mark all items as watched', () => {
    component['onMarkAllAsWatched']();

    expect(changeWatchedStatus.markAllAsWatched).toHaveBeenCalled();
    expect(changeWatchedStatus.markAllAsUnwatched).not.toHaveBeenCalled();
  });

  it('calls service to mark all items as unwatched', () => {
    component['onMarkAllAsUnwatched']();

    expect(changeWatchedStatus.markAllAsUnwatched).toHaveBeenCalled();
  });
});
