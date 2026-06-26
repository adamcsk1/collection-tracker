import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY } from 'rxjs';
import { CollectionService } from '../../collection/collection-service';
import { SettingsService } from '../../settings/settings-service';
import { LogoutService } from '../logout-service';

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
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('AppTitle')),
    menu: computed(() => this.ngxSignalTranslate.translate('Menu')),
    collection: computed(() => this.ngxSignalTranslate.translate('Collection')),
    watchLater: computed(() => this.ngxSignalTranslate.translate('WatchLater')),
    wishlist: computed(() => this.ngxSignalTranslate.translate('Wishlist')),
    seriesTracker: computed(() => this.ngxSignalTranslate.translate('SeriesTracker')),
    movieTracker: computed(() => this.ngxSignalTranslate.translate('MovieTracker')),
    settings: computed(() => this.ngxSignalTranslate.translate('Settings')),
    statistics: computed(() => this.ngxSignalTranslate.translate('Statistics')),
    sync: computed(() => this.ngxSignalTranslate.translate('Sync')),
    about: computed(() => this.ngxSignalTranslate.translate('About')),
    logout: computed(() => this.ngxSignalTranslate.translate('Logout')),
  };
  protected readonly themeLogo = this.theme.themeLogo;

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

  protected async onOpenStatistics(event?: Event): Promise<void> {
    event?.preventDefault();
    const { StatisticsDialog } = await import('../../statistics/statistics-dialog');
    this.portal.open(StatisticsDialog);
  }

  protected async onOpenAbout(event?: Event): Promise<void> {
    event?.preventDefault();
    const { AboutDialog } = await import('../../about/about-dialog');
    this.portal.open(AboutDialog);
  }
}
