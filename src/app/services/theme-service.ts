import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { SettingsModel } from '@pages/settings/settings.model';
import { appStateToken } from '@stores/app-store';
import { fromEvent } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly appStore = inject(appStateToken);
  private readonly document = inject(DOCUMENT);
  private readonly selectedTheme = signal<SettingsModel['theme']>('system');
  private readonly usedTheme = signal<SettingsModel['theme']>('system');
  private get htmlElement(): HTMLHtmlElement {
    return this.document.getElementsByTagName('html')[0];
  }
  private get mediaQuery(): MediaQueryList {
    return window.matchMedia('(prefers-color-scheme: dark)');
  }
  private listened = false;
  public readonly darkTheme = computed(() => ['dark'].includes(this.usedTheme()));

  constructor() {
    effect(() => {
      const theme = this.appStore.state.theme();
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
      this.switchTheme(this.appStore.state.theme());
      this.listened = true;
    }
  }

  private switchTheme(theme: SettingsModel['theme']): void {
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
    }
    this.selectedTheme.set('dark');
    this.usedTheme.set('dark');
  }

  private setLightTheme(): void {
    if (this.htmlElement) {
      this.htmlElement.classList.remove('dark');
      this.htmlElement.classList.add('light');
    }
    this.selectedTheme.set('light');
    this.usedTheme.set('light');
  }
}
