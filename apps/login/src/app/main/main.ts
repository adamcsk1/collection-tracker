import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { BlockerLoading } from '@components/blocker-loading/blocker-loading';
import { PosterBackground } from '@components/poster-background/poster-background';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { Toast } from '@components/toast/toast';
import { apiStateToken } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { isTransientHttpError } from '@services/api/http-error-util';
import { ThemeService } from '@services/theme/theme-service';
import { PortalService } from '@services/portal-service';
import { AndroidBackHandlerService } from '@services/android-back-handler-service';
import { themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL, STORAGE_LOGGED_IN } from '@shared/constants/storage-const';
import { getApiPrefix } from '@shared/utils/get-api-prefix-util';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, filter } from 'rxjs';

@Component({
  selector: 'ct-root',
  imports: [RouterOutlet, Toast, BlockerLoading, PosterBackground],
  templateUrl: './main.html',
  styleUrl: './main.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements AfterViewInit {
  private readonly androidBackHandler = inject(AndroidBackHandlerService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly webstorage = inject(WebstorageService);
  private readonly api = inject(PublicApiService);
  private readonly theme = inject(ThemeService);
  private readonly apiState = inject(apiStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  private readonly router = inject(Router);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly documentTitle = inject(Title);
  private readonly portal = inject(PortalService);
  private readonly portalHost = viewChild('portalHost', { read: ViewContainerRef });
  private readonly path = signal(this.router.navigated ? this.getPath(this.router.url) : '');
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('AppTitle')),
    signIn: computed(() => this.ngxSignalTranslate.translate('SignIn')),
    signUp: computed(() => this.ngxSignalTranslate.translate('SignUp')),
  };
  protected readonly themeLogo = this.theme.themeLogo;

  constructor() {
    this.androidBackHandler.listen();
    this.ngxSignalTranslate.setLanguage('en');
    effect(() => {
      const page = this.path() === 'sign-up' ? this.translations.signUp() : this.translations.signIn();
      this.documentTitle.setTitle(`${page} - ${this.translations.title()}`);
    });
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        const path = this.getPath(event.urlAfterRedirects);
        const previousPath = this.path();
        this.path.set(path);
        if (previousPath && previousPath !== path && (path === 'sign-in' || path === 'sign-up')) {
          this.element.nativeElement.querySelector<HTMLElement>('router-outlet + * h2')?.focus();
        }
      });
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

  private getPath(url: string): string {
    return (
      this.router
        .parseUrl(url)
        .root.children['primary']?.segments.map((segment) => segment.path)
        .join('/') ?? ''
    );
  }

  public ngAfterViewInit(): void {
    this.portal.setViewContainerRef(this.portalHost()!);
    if (this.webstorage.getItem(STORAGE_LOGGED_IN) !== 'true') {
      this.blockerLoadingState.setState('show', false);
      return;
    }

    this.api
      .validateSession()
      .pipe(
        catchError((error: unknown) => {
          if (!isTransientHttpError(error)) this.webstorage.removeItem(STORAGE_LOGGED_IN);
          this.blockerLoadingState.setState('show', false);
          return EMPTY;
        })
      )
      .subscribe(() => (window.location.href = `${getBasePath()}/client/`));
  }
}
