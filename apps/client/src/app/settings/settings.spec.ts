import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialMainState, mainStateToken } from '../main/main-store';
import { Settings } from './settings';

describe('Settings companion menu', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        provideRouter([]),
        provideStore(initialMainState, mainStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  afterEach(() => {
    delete window.CollectionTrackerInterface;
  });

  it.each([undefined, {}])('hides settings without native support: %s', async (bridge) => {
    window.CollectionTrackerInterface = bridge;
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-nav-companion-app"]')).toBeNull();
  });

  it('opens native settings and collapses mobile navigation without routing', async () => {
    const showSettings = vi.fn();
    window.CollectionTrackerInterface = { showSettings };
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const toggle = element.querySelector<HTMLButtonElement>('[data-test-id="settings-nav-toggle"]')!;
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const button = element.querySelector<HTMLButtonElement>('[data-test-id="settings-nav-companion-app"]')!;
    expect(button.textContent).toContain('Settings.CompanionApp');
    expect(button.type).toBe('button');
    button.click();
    await fixture.whenStable();
    expect(showSettings).toHaveBeenCalledExactlyOnceWith();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
