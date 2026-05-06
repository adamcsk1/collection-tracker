import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TokenDialog } from '../token-dialog/token-dialog';

import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { delay, tap } from 'rxjs';

@Component({
  selector: 'ct-account-actions',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './account-actions.html',
  styleUrl: './account-actions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountActions {
  private readonly confirm = inject(ConfirmService);
  private readonly api = inject(ApiService);
  private readonly toastState = inject(toastStateToken);
  private readonly portal = inject(PortalService);
  private readonly webstorage = inject(WebstorageService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected onCreateNewUserToken(): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.CreateNewUserToken'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.api
          .createNewUserToken()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((response) => {
            this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.NewUserTokenCreated'));
            this.portal.open(TokenDialog, {
              title: this.ngxSignalTranslate.translate('Title.NewUserToken'),
              message: this.ngxSignalTranslate.translate('Message.NewUserTokenCreated'),
              token: response.newToken,
            });
          });
      });
  }

  protected onDeleteUser(): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.DeleteUser'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.api
          .deleteUser()
          .pipe(
            tap(() => {
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.UserDeleted'));
              this.webstorage.clear();
            }),
            delay(2000),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe(() => (window.location.href = '/login/'));
      });
  }
}
