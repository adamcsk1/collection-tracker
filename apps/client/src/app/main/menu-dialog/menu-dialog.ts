import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { catchError, EMPTY } from 'rxjs';
import { CollectionService } from '../../collection/collection-service';
import { LogoutService } from '../logout-service';
import { mainStateToken } from '../main-store';

@Component({
  selector: 'ct-menu-dialog',
  imports: [RouterLink, RouterLinkActive, NgxSignalTranslatePipe, DialogShell],
  templateUrl: './menu-dialog.html',
  styleUrl: './menu-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dialog',
  },
})
export class MenuDialog {
  private readonly mainState = inject(mainStateToken);
  private readonly collection = inject(CollectionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly logout = inject(LogoutService);
  private readonly portal = inject(PortalService);
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
