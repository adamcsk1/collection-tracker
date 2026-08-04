import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, filter, map, startWith } from 'rxjs';
import { CollectionService } from '../../collection/collection-service';
import { SettingsService } from '../../settings/settings-service';
import { LogoutService } from '../logout-service';
import { mainStateToken } from '../main-store';

@Component({
  selector: 'ct-menu-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './menu-nav.html',
  styleUrl: './menu-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuNav {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly collection = inject(CollectionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly logout = inject(LogoutService);
  private readonly portal = inject(PortalService);
  private readonly theme = inject(ThemeService);
  private readonly settings = inject(SettingsService);
  private readonly mainState = inject(mainStateToken);
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );
  protected readonly collectionNavActive = computed(() => {
    const path = this.currentUrl().split('?')[0].split('#')[0];
    return (
      path.startsWith('/collection/library') ||
      path.startsWith('/collection/books') ||
      path === '/collection' ||
      path === '/collection/'
    );
  });
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('AppTitle')),
    menu: computed(() => this.ngxSignalTranslate.translate('Menu')),
    collection: computed(() => this.ngxSignalTranslate.translate('Collection')),
    wishlist: computed(() => this.ngxSignalTranslate.translate('Wishlist')),
    watchlist: computed(() => this.ngxSignalTranslate.translate('Watchlist')),
    tracking: computed(() => this.ngxSignalTranslate.translate('Tracking')),
    finished: computed(() => this.ngxSignalTranslate.translate('Finished')),
    settings: computed(() => this.ngxSignalTranslate.translate('Settings')),
    statistics: computed(() => this.ngxSignalTranslate.translate('Statistics')),
    sync: computed(() => this.ngxSignalTranslate.translate('Sync')),
    about: computed(() => this.ngxSignalTranslate.translate('About')),
    logout: computed(() => this.ngxSignalTranslate.translate('Logout')),
  };
  protected readonly themeLogo = this.theme.themeLogo;
  protected readonly featurePreferences = this.mainState.state.collectionFeaturePreferences;

  protected onSync(): void {
    this.settings
      .preloadUserSettings()
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
    this.collection.triggerReload();
    this.portal.closeAll();
  }

  protected onLogout(): void {
    this.api
      .logout()
      .pipe(
        catchError(() => {
          this.logout.performLogout();
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.logout.performLogout());
  }

  protected onClose(): void {
    this.portal.closeAll();
  }

  protected async onOpenAbout(event?: Event): Promise<void> {
    event?.preventDefault();
    const { AboutDialog } = await import('../../about/about-dialog');
    this.portal.open(AboutDialog);
  }
}
