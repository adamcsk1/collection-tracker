import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BlockerLoading } from '@components/blocker-loading/blocker-loading';
import { PosterBackground } from '@components/poster-background/poster-background';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { Toast } from '@components/toast/toast';
import { apiStateToken } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { isRateLimitError } from '@services/api/http-error-util';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL, STORAGE_LOGGED_IN } from '@shared/constants/storage-const';
import { getApiPrefix } from '@shared/utils/get-api-prefix-util';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY } from 'rxjs';

@Component({
  selector: 'ct-root',
  imports: [RouterOutlet, Toast, BlockerLoading, PosterBackground],
  templateUrl: './main.html',
  styleUrl: './main.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements AfterViewInit {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly webstorage = inject(WebstorageService);
  private readonly api = inject(PublicApiService);
  private readonly theme = inject(ThemeService);
  private readonly apiState = inject(apiStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('AppTitle')),
  };
  protected readonly themeLogo = this.theme.themeLogo;

  constructor() {
    this.ngxSignalTranslate.setLanguage('en');
    this.blockerLoadingState.setState('withoutDelay', true);
    this.blockerLoadingState.setState('show', true);
    this.themeState.setState('theme', 'light');
    this.theme.listen();

    let apiUrl = this.webstorage.getItem(STORAGE_API_URL);

    if (!apiUrl) {
      apiUrl = `${window.location.origin}${getApiPrefix()}`;
      this.webstorage.setItem(STORAGE_API_URL, apiUrl);
    }
    this.apiState.setState('apiUrl', apiUrl);
  }

  public ngAfterViewInit(): void {
    if (this.webstorage.getItem(STORAGE_LOGGED_IN) !== 'true') {
      this.blockerLoadingState.setState('show', false);
      return;
    }

    this.api
      .validateSession()
      .pipe(
        catchError((error: unknown) => {
          if (!isRateLimitError(error)) this.webstorage.removeItem(STORAGE_LOGGED_IN);
          this.blockerLoadingState.setState('show', false);
          return EMPTY;
        })
      )
      .subscribe(() => (window.location.href = `${getBasePath()}/client/`));
  }
}
