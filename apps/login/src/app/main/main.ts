import { AfterViewInit, ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BlockerLoading } from '@components/blocker-loading/blocker-loading';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { Toast } from '@components/toast/toast';
import { apiStateToken } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { getApiPrefix } from '@shared/utils/get-api-prefix-util';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY } from 'rxjs';

@Component({
  selector: 'lo-root',
  imports: [RouterOutlet, Toast, BlockerLoading],
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
    title: computed(() => this.ngxSignalTranslate.translate('Title')),
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
    this.api
      .validateSession()
      .pipe(
        catchError(() => {
          this.blockerLoadingState.setState('show', false);
          return EMPTY;
        })
      )
      .subscribe(() => (window.location.href = `${getBasePath()}/client/`));
  }
}
