import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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
        provideRouter([{ path: 'settings/:section', children: [] }]),
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

  it('toggles the controlled navigation and hides the decorative toggle icon', async () => {
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const toggle = element.querySelector<HTMLButtonElement>('[data-test-id="settings-nav-toggle"]')!;
    const navigation = element.querySelector<HTMLElement>('#settings-nav')!;

    expect(toggle.getAttribute('aria-controls')).toBe(navigation.id);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(navigation.classList.contains('is-expanded')).toBe(false);
    expect(toggle.querySelector('i')!.getAttribute('aria-hidden')).toBe('true');

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(navigation.classList.contains('is-expanded')).toBe(true);

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(navigation.classList.contains('is-expanded')).toBe(false);
  });

  it('marks only the current settings page and updates on navigation', async () => {
    const fixture = TestBed.createComponent(Settings);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/settings/basics');
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
    expect(element.querySelector('[data-test-id="settings-nav-basics"]')!.getAttribute('aria-current')).toBe('page');

    await router.navigateByUrl('/settings/account');
    await fixture.whenStable();
    expect(element.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
    expect(element.querySelector('[data-test-id="settings-nav-basics"]')!.hasAttribute('aria-current')).toBe(false);
    expect(element.querySelector('[data-test-id="settings-nav-account"]')!.getAttribute('aria-current')).toBe('page');
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
