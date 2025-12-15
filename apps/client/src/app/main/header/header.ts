import { ChangeDetectionStrategy, Component, DestroyRef, DOCUMENT, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CollectionService } from '@client/collection/collection-service';
import { mainStateToken } from '@client/main/main-store';
import { redirectToLogin } from '@client/main/main-util';
import { ApiService } from '@services/api/api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { catchError, EMPTY } from 'rxjs';

@Component({
  selector: 'ct-header',
  imports: [RouterLink, RouterLinkActive, NgxSignalTranslatePipe],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'banner',
  },
})
export class Header {
  private readonly document = inject(DOCUMENT);
  private readonly mainState = inject(mainStateToken);
  private readonly collection = inject(CollectionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly webstorage = inject(WebstorageService);
  protected readonly showMenu = signal(false);
  protected readonly settingLockEnabled = this.mainState.state.settingsLock;

  protected onShowMenu($event: Event): void {
    if ($event.type !== 'mouseenter' || this.document.body.offsetWidth > 450) this.showMenu.set(true);
  }

  protected onHideMenu(): void {
    this.showMenu.set(false);
  }

  protected onSync(): void {
    this.collection.loadCollection();
  }

  protected onLogout(): void {
    this.api
      .logout()
      .pipe(
        catchError(() => {
          if (this.mainState.state.clearLocalStorageAfterLogout()) this.webstorage.clear();
          redirectToLogin();
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.mainState.state.clearLocalStorageAfterLogout()) this.webstorage.clear();
        redirectToLogin();
      });
  }
}
