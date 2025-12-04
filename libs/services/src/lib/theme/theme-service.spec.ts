import { TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { ThemeService } from './theme-service';
import { ThemeState, initialThemeState, themeStateToken } from './theme-store';

type MatchMediaMock = {
  matches: boolean;
  media: string;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  dispatch: (matches: boolean) => void;
};

const createMatchMediaMock = (): MatchMediaMock => {
  const listeners: Array<(event: MediaQueryListEvent) => void> = [];
  const mock: MatchMediaMock = {
    matches: false,
    media: '(prefers-color-scheme: dark)',
    addEventListener: jest.fn((event, callback) => {
      if (event === 'change') listeners.push(callback as (event: MediaQueryListEvent) => void);
    }),
    removeEventListener: jest.fn(),
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
  let translateSpy: jest.Mock;
  let mediaQueryMock: MatchMediaMock;
  let metaThemeColor: HTMLMetaElement;

  beforeEach(() => {
    jest.useFakeTimers();
    mediaQueryMock = createMatchMediaMock();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => mediaQueryMock),
    });

    document.head.innerHTML = '';
    document.body.style.setProperty('--theme-color', '#123456');
    metaThemeColor = document.createElement('meta');
    metaThemeColor.name = 'theme-color';
    metaThemeColor.content = '#fff';
    document.head.appendChild(metaThemeColor);

    translateSpy = jest.fn((value: string) => `t:${value}`);

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
    jest.useRealTimers();
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
    jest.runOnlyPendingTimers();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(service.darkTheme()).toBe(true);
    expect(metaThemeColor.content).toBe('#123456');

    themeState.setState('theme', 'light');
    await Promise.resolve();
    jest.runOnlyPendingTimers();

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
});
