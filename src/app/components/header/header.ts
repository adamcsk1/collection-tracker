import { Component, DestroyRef, DOCUMENT, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ConfirmService } from '@lib/services/confirm-service';
import { CollectionService } from '@services/collection/collection-service';
import { DisconnectService } from '@services/disconnect-service';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'ct-header',
  imports: [RouterLink, RouterLinkActive, NgxSignalTranslatePipe],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  private readonly document = inject(DOCUMENT);
  private readonly collection = inject(CollectionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly disconnect = inject(DisconnectService);
  private readonly router = inject(Router);

  protected onRemoveFocus(): void {
    (this.document.activeElement as HTMLElement)?.blur();
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
          this.disconnect.disconnect();
          window.location.reload();
        }
      });
  }
}
