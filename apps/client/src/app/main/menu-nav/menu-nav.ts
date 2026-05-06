import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { catchError, EMPTY } from 'rxjs';
import { CollectionService } from '../../collection/collection-service';
import { LogoutService } from '../logout-service';
import { mainStateToken } from '../main-store';

@Component({
  selector: 'ct-menu-nav',
  imports: [RouterLink, RouterLinkActive, NgxSignalTranslatePipe],
  templateUrl: './menu-nav.html',
  styleUrl: './menu-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuNav {
  private readonly mainState = inject(mainStateToken);
  private readonly collection = inject(CollectionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly logout = inject(LogoutService);
  private readonly portal = inject(PortalService);
  private readonly theme = inject(ThemeService);
  protected readonly themeLogo = this.theme.themeLogo;
  protected readonly settingLockEnabled = this.mainState.state.settingsLock;

  protected onSync(): void {
    this.collection.triggerReload();
    this.portal.close();
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
    this.portal.close();
  }
}
