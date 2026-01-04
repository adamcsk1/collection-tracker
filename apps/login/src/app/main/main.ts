import { AfterViewInit, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BlockerLoading } from '@components/blocker-loading/blocker-loading';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { Toast } from '@components/toast/toast';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { Themes } from '@services/theme/theme-model';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { API_PREFIX } from '@shared/constants/api-const';
import { STORAGE_API_URL, STORAGE_LANGUAGE, STORAGE_THEME } from '@shared/constants/storage-const';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { EMPTY, catchError } from 'rxjs';

@Component({
  selector: 'lo-root',
  imports: [RouterOutlet, NgxSignalTranslatePipe, Toast, BlockerLoading],
  templateUrl: './main.html',
  styleUrl: './main.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements AfterViewInit {
  private readonly signalTranslateService = inject(NgxSignalTranslateService);
  private readonly webstorage = inject(WebstorageService);
  private readonly api = inject(ApiService);
  private readonly theme = inject(ThemeService);
  private readonly apiState = inject(apiStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  protected readonly themeLogo = this.theme.themeLogo;

  constructor() {
    const language = this.webstorage.getItem(STORAGE_LANGUAGE) || 'en';
    this.signalTranslateService.setLanguage(language);
    this.blockerLoadingState.setState('withoutDelay', true);
    this.blockerLoadingState.setState('show', true);
    this.themeState.setState('theme', (this.webstorage.getItem(STORAGE_THEME) as Themes) || 'light');
    this.theme.listen();

    let apiUrl = this.webstorage.getItem(STORAGE_API_URL);

    if (!apiUrl) {
      apiUrl = `${window.location.origin}${API_PREFIX}`;
      this.webstorage.setItem(STORAGE_API_URL, apiUrl);
    }
    this.apiState.setState('apiUrl', apiUrl);
  }

  public ngAfterViewInit(): void {
    this.api
      .validateAccessToken()
      .pipe(
        catchError(() => {
          this.blockerLoadingState.setState('show', false);
          return EMPTY;
        })
      )
      .subscribe(() => (window.location.href = '/client/'));
  }
}
