import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { filter, map, startWith } from 'rxjs';
import { MenuDialog } from '../menu-dialog/menu-dialog';

@Component({
  selector: 'ct-header',
  imports: [RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'banner',
  },
})
export class Header {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  protected readonly translations = {
    menu: computed(() => this.ngxSignalTranslate.translate('Menu')),
    title: computed(() => this.ngxSignalTranslate.translate('AppTitle')),
  };
  protected readonly currentNavTitle = computed(() => this.ngxSignalTranslate.translate(this.currentNavTitleKey()));

  protected onOpenMenu(): void {
    this.portal.open(MenuDialog);
  }

  private currentNavTitleKey(): string {
    const currentPath = this.currentUrl().split('?')[0].split('#')[0];

    if (currentPath.startsWith('/collection/favorites')) {
      return 'Favorites';
    }
    if (currentPath.startsWith('/collection/watch-later')) {
      return 'WatchLater';
    }
    if (currentPath.startsWith('/collection/wishlist')) {
      return 'Wishlist';
    }
    if (currentPath.startsWith('/collection/series-tracker')) {
      return 'SeriesTracker';
    }
    if (currentPath.startsWith('/settings')) {
      return 'Settings';
    }
    if (currentPath.startsWith('/statistics')) {
      return 'Statistics';
    }
    if (currentPath.startsWith('/about')) {
      return 'About';
    }

    return 'Collection';
  }
}
