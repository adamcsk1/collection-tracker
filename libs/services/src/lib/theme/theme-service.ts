import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Themes } from '@services/theme/theme-model';
import { themeStateToken } from '@services/theme/theme-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { fromEvent } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly themeStore = inject(themeStateToken);
  private readonly document = inject(DOCUMENT);
  private readonly selectedTheme = signal<Themes>('system');
  private readonly usedTheme = signal<Themes>('system');
  private get htmlElement(): HTMLHtmlElement {
    return this.document.getElementsByTagName('html')[0];
  }
  private get mediaQuery(): MediaQueryList {
    return window.matchMedia('(prefers-color-scheme: dark)');
  }
  private listened = false;
  public readonly darkTheme = computed(() => ['dark'].includes(this.usedTheme()));
  public readonly themeOptions = computed(() => [
    { text: this.ngxSignalTranslate.translate('System'), value: 'system' },
    { text: this.ngxSignalTranslate.translate('SolarizedLight'), value: 'light' },
    { text: this.ngxSignalTranslate.translate('SolarizedDark'), value: 'dark' },
  ]);

  constructor() {
    effect(() => {
      const theme = this.themeStore.state.theme();
      untracked(() => {
        if (theme !== this.selectedTheme()) this.switchTheme(theme);
      });
    });
  }

  public listen(): void {
    if (!this.listened) {
      fromEvent<MediaQueryListEvent>(this.mediaQuery, 'change').subscribe((event: MediaQueryListEvent) =>
        this.setSystemTheme(event)
      );
      this.switchTheme(this.themeStore.state.theme());
      this.listened = true;
    }
  }

  private switchTheme(theme: Themes): void {
    switch (theme) {
      case 'dark':
        return this.setDarkTheme();
      case 'light':
        return this.setLightTheme();
      default:
        return this.setSystemTheme(this.mediaQuery);
    }
  }

  private setSystemTheme(event: MediaQueryListEvent | MediaQueryList): void {
    if (event.matches) this.setDarkTheme();
    else this.setLightTheme();
    this.selectedTheme.set('system');
  }

  private setDarkTheme(): void {
    if (this.htmlElement) {
      this.htmlElement.classList.remove('light');
      this.htmlElement.classList.add('dark');
      this.setMetaThemeColor();
    }
    this.selectedTheme.set('dark');
    this.usedTheme.set('dark');
  }

  private setLightTheme(): void {
    if (this.htmlElement) {
      this.htmlElement.classList.remove('dark');
      this.htmlElement.classList.add('light');
      this.setMetaThemeColor();
    }
    this.selectedTheme.set('light');
    this.usedTheme.set('light');
  }

  private setMetaThemeColor(): void {
    (this.document.querySelector('meta[name="theme-color"]') as HTMLMetaElement)!.content = getComputedStyle(
      this.document.body
    ).getPropertyValue('--theme-color');
  }
}
