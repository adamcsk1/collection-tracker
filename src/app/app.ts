import { Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Header } from '@components/header/header';
import { SpinnerLoading } from '@lib/components/spinner-loading/spinner-loading';
import { Toast } from '@lib/components/toast/toast';
import { ThemeService } from '@lib/services/theme/theme-service';
import { SettingsService } from '@pages/settings/settings-service';
import { CollectionService } from '@services/collection/collection-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'ct-root',
  imports: [RouterOutlet, Header, SpinnerLoading, Toast],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly signalTranslateService = inject(NgxSignalTranslateService);
  private readonly settings = inject(SettingsService);
  private readonly collectionService = inject(CollectionService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);

  constructor() {
    const effectRef = effect(() => {
      if (this.settings.hasSettings()) {
        this.collectionService.loadCollection();
        effectRef.destroy();
      }
    });

    this.signalTranslateService.setLanguage('en');
    this.settings.loadStoredData();
    this.theme.listen();

    if (!this.settings.hasSettings()) this.router.navigate(['/', 'settings']);
  }
}
