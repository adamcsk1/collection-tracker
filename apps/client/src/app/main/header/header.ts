import { Component, DestroyRef, DOCUMENT, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CollectionService } from '@client/collection/collection-service';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { HeaderService } from './header-service';

@Component({
  selector: 'ct-header',
  imports: [RouterLink, RouterLinkActive, NgxSignalTranslatePipe],
  templateUrl: './header.html',
  styleUrl: './header.css',
  providers: [HeaderService],
})
export class Header {
  private readonly document = inject(DOCUMENT);
  private readonly collection = inject(CollectionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly header = inject(HeaderService);
  protected readonly showMenu = signal(false);

  protected onShowMenu($event: Event): void {
    if ($event.type !== 'mouseenter' || this.document.body.offsetWidth > 450) this.showMenu.set(true);
  }

  protected onHideMenu(): void {
    this.showMenu.set(false);
  }

  protected onSync(): void {
    this.collection.loadCollection();
  }

  protected onDisconnect(): void {
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.Disconnect'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.header.disconnect();
          window.location.reload();
        }
      });
  }
}
