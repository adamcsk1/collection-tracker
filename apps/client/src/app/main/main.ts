import { ChangeDetectionStrategy, Component, effect, inject, OnInit, viewChild, ViewContainerRef } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CollectionService } from '@client/collection/collection-service';
import { MainHeader } from '@client/main/main-header/main-header';
import { MainService } from '@client/main/main-service';
import { SpinnerLoading } from '@components/spinner-loading/spinner-loading';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { Toast } from '@components/toast/toast';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'ct-root',
  imports: [RouterOutlet, MainHeader, SpinnerLoading, Toast],
  templateUrl: './main.html',
  styleUrl: './main.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements OnInit {
  private readonly apiState = inject(apiStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly portal = inject(PortalService);
  private readonly main = inject(MainService);
  private readonly router = inject(Router);
  private readonly signalTranslateService = inject(NgxSignalTranslateService);
  private readonly collectionService = inject(CollectionService);
  private readonly theme = inject(ThemeService);
  private readonly api = inject(ApiService);
  private readonly collectionDialogsRef = viewChild('portal', { read: ViewContainerRef });

  constructor() {
    effect(() => {
      const loadNetworkStatus = this.apiState.state.loadNetworkStatus();

      if (loadNetworkStatus === 'pending') this.spinnerLoadingState.setState('show', true);
      else if (['finished', 'error'].includes(loadNetworkStatus || '')) {
        this.spinnerLoadingState.setState('show', false);
      }
    });

    const effectRef = effect(() => {
      const tokenValidated = this.main.tokenValid();
      if (tokenValidated) {
        if (!this.omdbState.state.apiKey()) this.router.navigate(['settings']);
        this.collectionService.loadCollection();
        effectRef.destroy();
      } else if (tokenValidated === false) {
        window.location.href = '/login/';
        effectRef.destroy();
      }
    });

    this.main.loadStoredData();

    this.signalTranslateService.setLanguage('en');
    this.theme.listen();
  }

  public ngOnInit(): void {
    this.portal.setViewContainerRef(this.collectionDialogsRef()!);
  }
}
