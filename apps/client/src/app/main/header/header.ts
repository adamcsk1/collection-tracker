import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { filter, map, startWith } from 'rxjs';

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
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );
  protected readonly themeLogo = this.theme.themeLogo;
  protected readonly translations = {
    menu: computed(() => this.ngxSignalTranslate.translate('Menu')),
    title: computed(() => this.ngxSignalTranslate.translate('AppTitle')),
  };
  protected readonly currentNavTitle = computed(() => this.ngxSignalTranslate.translate(this.currentNavTitleKey()));

  private currentNavTitleKey(): string {
    const currentPath = this.currentUrl().split('?')[0].split('#')[0];

    if (currentPath.startsWith('/collection/watchlist')) {
      return 'Watchlist';
    }
    if (currentPath.startsWith('/collection/wishlist')) {
      return 'Wishlist';
    }
    if (currentPath.startsWith('/collection/watching')) {
      return 'Watching';
    }
    if (currentPath.startsWith('/collection/watched')) {
      return 'Watched';
    }
    if (currentPath.startsWith('/collection/books')) {
      return 'Books';
    }
    if (currentPath.startsWith('/settings')) {
      return 'Settings';
    }
    if (currentPath.startsWith('/statistics')) {
      return 'Statistics';
    }
    return 'Collection';
  }
}
