import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { Avatar } from '@components/avatar/avatar';
import { ActionMenu } from '@components/action-menu/action-menu';
import { ActionMenuActionModel } from '@components/action-menu/action-menu-model';
import { ProfileStore } from '@services/profile/profile-store';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, filter, map, startWith } from 'rxjs';
import { LogoutService } from '../logout-service';
import { mainStateToken } from '../main-store';

@Component({
  selector: 'ct-menu-nav',
  imports: [RouterLink, RouterLinkActive, Avatar, ActionMenu],
  templateUrl: './menu-nav.html',
  styleUrl: './menu-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuNav {
  protected readonly profile = inject(ProfileStore).profile;
  protected readonly profileName = computed(() => {
    const profile = this.profile();
    return profile?.displayName || profile?.username || profile?.userShareCode || this.translations.account();
  });
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly logout = inject(LogoutService);
  private readonly portal = inject(PortalService);
  private readonly theme = inject(ThemeService);
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
      path.startsWith('/collection/music') ||
      path === '/collection' ||
      path === '/collection/'
    );
  });
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('AppTitle')),
    menu: computed(() => this.ngxSignalTranslate.translate('Menu')),
    collection: computed(() => this.ngxSignalTranslate.translate('Collection')),
    wishlist: computed(() => this.ngxSignalTranslate.translate('Wishlist')),
    upNext: computed(() => this.ngxSignalTranslate.translate('UpNext')),
    tracking: computed(() => this.ngxSignalTranslate.translate('Tracking')),
    settings: computed(() => this.ngxSignalTranslate.translate('Settings')),
    statistics: computed(() => this.ngxSignalTranslate.translate('Statistics')),
    about: computed(() => this.ngxSignalTranslate.translate('About')),
    logout: computed(() => this.ngxSignalTranslate.translate('Logout')),
    account: computed(() => this.ngxSignalTranslate.translate('Account')),
  };
  protected readonly accountActions = computed<ActionMenuActionModel[]>(() => [
    { id: 'nav-settings', label: this.translations.settings(), icon: 'settings' },
    { id: 'nav-about', label: this.translations.about(), icon: 'info' },
    { id: 'nav-logout', label: this.translations.logout(), icon: 'logout', destructive: true },
  ]);
  protected readonly themeLogo = this.theme.themeLogo;
  protected readonly featurePreferences = this.mainState.state.collectionFeaturePreferences;

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

  protected onAccountAction(action: string): void {
    if (action === 'nav-logout') {
      this.onLogout();
    } else {
      void this.router.navigate(['/', action === 'nav-settings' ? 'settings' : 'about']);
      this.onClose();
    }
  }

  protected onClose(): void {
    this.portal.closeAll();
  }
}
