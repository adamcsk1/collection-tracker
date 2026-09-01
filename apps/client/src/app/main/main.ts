import { ChangeDetectionStrategy, Component, effect, inject, OnInit, viewChild, ViewContainerRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PosterBackground } from '@components/poster-background/poster-background';
import { FloatActions } from './float-actions/float-actions';
import { Header } from './header/header';
import { MenuNav } from './menu-nav/menu-nav';
import { MainService } from './main-service';
import { mainStateToken } from './main-store';
import { TokenValidationService } from './token-validation-service';
import { BlockerLoading } from '@components/blocker-loading/blocker-loading';
import { SpinnerLoading } from '@components/spinner-loading/spinner-loading';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { Toast } from '@components/toast/toast';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { AndroidBackHandlerService } from './android-back-handler-service';

@Component({
  selector: 'ct-root',
  imports: [RouterOutlet, Header, MenuNav, SpinnerLoading, Toast, PosterBackground, BlockerLoading, FloatActions],
  templateUrl: './main.html',
  styleUrl: './main.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements OnInit {
  private readonly androidBackHandler = inject(AndroidBackHandlerService);
  private readonly mainState = inject(mainStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly portal = inject(PortalService);
  private readonly main = inject(MainService);
  private readonly tokenValidation = inject(TokenValidationService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly theme = inject(ThemeService);
  private readonly collectionDialogsRef = viewChild('portal', { read: ViewContainerRef });
  protected readonly useAnimatedBackground = this.mainState.state.animatedBackground;
  protected readonly backgroundImagesRefreshTrigger = this.mainState.state.backgroundImagesRefreshTrigger;

  constructor() {
    effect(() => {
      const loadNetworkStatus = this.apiState.state.loadNetworkStatus();

      if (loadNetworkStatus === 'pending') this.spinnerLoadingState.setState('show', true);
      else if (['finished', 'error'].includes(loadNetworkStatus || '')) {
        this.spinnerLoadingState.setState('show', false);
      }
    });

    this.tokenValidation.startValidation();
    this.main.loadStoredData();
    this.ngxSignalTranslate.setLanguage(this.mainState.state.language());
    this.theme.listen();
    this.androidBackHandler.listen();
  }

  public ngOnInit(): void {
    this.portal.setViewContainerRef(this.collectionDialogsRef()!);
  }
}
