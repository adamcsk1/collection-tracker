import { ComponentFixture, TestBed } from '@angular/core/testing';
import { About } from './about';
import { mainStateToken, initialMainState } from '../main/main-store';
import { toastStateToken, initialToastState } from '@components/toast/toast-store';
import { provideStore, NgxSimpleSignalStoreService } from 'ngx-simple-signal-store';
import { ThemeService } from '@services/theme/theme-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_SETTINGS_LOCK } from '@shared/constants/storage-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('About', () => {
  let fixture: ComponentFixture<About>;
  let component: About;
  let mainState: NgxSimpleSignalStoreService<typeof initialMainState>;
  let toastState: NgxSimpleSignalStoreService<typeof initialToastState>;
  let webstorage: { setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    webstorage = { setItem: vi.fn(), removeItem: vi.fn() };

    TestBed.configureTestingModule({
      imports: [About],
      providers: [
        provideStore(initialMainState, mainStateToken),
        provideStore(initialToastState, toastStateToken),
        { provide: ThemeService, useValue: { themeLogo: () => 'logo.png' } },
        { provide: WebstorageService, useValue: webstorage },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    TestBed.overrideComponent(About, { set: { template: '' } });

    mainState = TestBed.inject(mainStateToken);
    toastState = TestBed.inject(toastStateToken);
  });

  const setup = (settingsLock = false) => {
    mainState.setState('settingsLock', settingsLock);
    fixture = TestBed.createComponent(About);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('exposes static build info and theme logo', () => {
    setup();

    expect(component['build']).toBe('localhost-build');
    expect(component['buildDate']).toBe('localhost-build-date');
    expect(component['appVersion']).toBe('localhost-version');
    expect(component['themeLogo']()).toBe('logo.png');
  });

  it('disables settings lock on the 10th click and resets counter after debounce', () => {
    vi.useFakeTimers();
    setup(true);

    for (let i = 0; i < 9; i++) {
      component['onClickAppVersion']();
    }

    expect(mainState.state.settingsLock()).toBe(true);
    expect(toastState.state.message()).toContain('Toast.SettingsLockDisable');

    component['onClickAppVersion']();

    expect(mainState.state.settingsLock()).toBe(false);
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_SETTINGS_LOCK, 'false');
    expect(toastState.state.message()).toBe('Toast.SettingsLockDisabled');

    vi.advanceTimersByTime(1100);
    vi.useRealTimers();
  });

  it('does not react to version clicks when settingsLock is false', () => {
    setup(false);

    component['onClickAppVersion']();

    expect(mainState.state.settingsLock()).toBe(false);
    expect(webstorage.setItem).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('reacts to keydown on version element', () => {
    vi.useFakeTimers();
    setup(true);

    for (let i = 0; i < 9; i++) {
      component['onClickAppVersion']();
    }

    expect(mainState.state.settingsLock()).toBe(true);

    component['onClickAppVersion']();

    expect(mainState.state.settingsLock()).toBe(false);
    vi.useRealTimers();
  });
});
