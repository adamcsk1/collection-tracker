import { Component, effect, inject, OnInit, viewChild, ViewContainerRef } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CollectionService } from '@client/collection/collection-service';
import { SettingsService } from '@client/settings/settings-service';
import { SpinnerLoading } from '@components/spinner-loading/spinner-loading';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { Toast } from '@components/toast/toast';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { Header } from './header/header';

@Component({
  selector: 'ct-root',
  imports: [RouterOutlet, Header, SpinnerLoading, Toast],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly apiState = inject(apiStateToken);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly portal = inject(PortalService);
  private readonly signalTranslateService = inject(NgxSignalTranslateService);
  private readonly settings = inject(SettingsService);
  private readonly collectionService = inject(CollectionService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly collectionDialogsRef = viewChild('portal', { read: ViewContainerRef });

  constructor() {
    const effectRef = effect(() => {
      if (this.settings.hasSettings()) {
        this.collectionService.loadCollection();
        effectRef.destroy();
      }
    });

    effect(() => {
      const loadNetworkStatus = this.apiState.state.loadNetworkStatus();
      if (loadNetworkStatus === 'pending') this.spinnerLoadingState.setState('show', true);
      else if (['finished', 'error'].includes(loadNetworkStatus || '')) {
        this.spinnerLoadingState.setState('show', false);
      }
    });

    this.signalTranslateService.setLanguage('en');
    this.settings.loadStoredData();
    this.theme.listen();

    if (!this.settings.hasSettings()) this.router.navigate(['/', 'settings']);
  }

  public ngOnInit(): void {
    this.portal.setViewContainerRef(this.collectionDialogsRef()!);
  }
}
