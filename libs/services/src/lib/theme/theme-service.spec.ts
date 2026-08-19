import { TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from './theme-service';
import { initialThemeState, themeStateToken, type ThemeState } from './theme-store';

type MatchMediaMock = {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  dispatch: (matches: boolean) => void;
};

const createMatchMediaMock = (): MatchMediaMock => {
  const listeners: ((event: MediaQueryListEvent) => void)[] = [];
  const mock: MatchMediaMock = {
    matches: false,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((event, callback) => {
      if (event === 'change') listeners.push(callback as (event: MediaQueryListEvent) => void);
    }),
    removeEventListener: vi.fn(),
    dispatch(matches: boolean) {
      mock.matches = matches;
      listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
    },
  };

  return mock;
};

describe('ThemeService', () => {
  let service: ThemeService;
  let themeState: NgxSimpleSignalStoreService<ThemeState>;
  let translateSpy: ReturnType<typeof vi.fn>;
  let mediaQueryMock: MatchMediaMock;
  let metaThemeColor: HTMLMetaElement;

  beforeEach(() => {
    vi.useFakeTimers();
    mediaQueryMock = createMatchMediaMock();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => mediaQueryMock),
    });

    document.head.innerHTML = '';
    document.body.style.setProperty('--theme-color', '#123456');
    metaThemeColor = document.createElement('meta');
    metaThemeColor.name = 'theme-color';
    metaThemeColor.content = '#fff';
    document.head.appendChild(metaThemeColor);

    translateSpy = vi.fn((value: string) => `t:${value}`);

    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        provideStore(initialThemeState, themeStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: translateSpy } },
      ],
    });

    service = TestBed.inject(ThemeService);
    themeState = TestBed.inject(themeStateToken);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns translated theme options', () => {
    expect(service.themeOptions()).toEqual([
      { text: 't:System', value: 'system' },
      { text: 't:Light', value: 'light' },
      { text: 't:Dark', value: 'dark' },
    ]);
    expect(translateSpy).toHaveBeenCalledWith('System');
    expect(translateSpy).toHaveBeenCalledWith('Light');
    expect(translateSpy).toHaveBeenCalledWith('Dark');
  });

  it('updates DOM classes and meta when switching themes', async () => {
    service.listen();

    themeState.setState('theme', 'dark');
    await Promise.resolve();
    vi.runOnlyPendingTimers();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(service.darkTheme()).toBe(true);
    expect(metaThemeColor.content).toBe('#123456');

    themeState.setState('theme', 'light');
    await Promise.resolve();
    vi.runOnlyPendingTimers();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(service.darkTheme()).toBe(false);
    expect(metaThemeColor.content).toBe('#123456');
  });

  it('responds to system theme changes after listen()', () => {
    themeState.setState('theme', 'system');
    service.listen();

    mediaQueryMock.dispatch(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(service.darkTheme()).toBe(true);

    mediaQueryMock.dispatch(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(service.darkTheme()).toBe(false);
  });

  it('derives themeLogo based on active theme', async () => {
    // Before listen(), remains default system logo
    expect(service.themeLogo()).toBe('logo.png');

    // System theme follows media query after listen()
    themeState.setState('theme', 'system');
    service.listen();
    mediaQueryMock.dispatch(true);
    await Promise.resolve();
    vi.runOnlyPendingTimers();
    expect(service.themeLogo()).toBe('logo-dark.png');

    mediaQueryMock.dispatch(false);
    await Promise.resolve();
    vi.runOnlyPendingTimers();
    expect(service.themeLogo()).toBe('logo-light.png');

    // Explicit theme selections
    themeState.setState('theme', 'dark');
    await Promise.resolve();
    vi.runOnlyPendingTimers();
    expect(service.themeLogo()).toBe('logo-dark.png');

    themeState.setState('theme', 'light');
    await Promise.resolve();
    vi.runOnlyPendingTimers();
    expect(service.themeLogo()).toBe('logo-light.png');
  });

  it('does not throw when theme-color meta tag is missing', async () => {
    metaThemeColor.remove();

    service.listen();
    themeState.setState('theme', 'dark');
    await Promise.resolve();
    vi.runOnlyPendingTimers();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
