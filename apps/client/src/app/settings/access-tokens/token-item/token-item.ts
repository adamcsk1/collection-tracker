import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmService } from '@services/confirm-service';
import { AccessTokenModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'ct-token-item',
  imports: [DatePipe],
  templateUrl: './token-item.html',
  styleUrl: './token-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TokenItem {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmService);
  protected readonly translations = {
    tokenHash: computed(() => this.ngxSignalTranslate.translate('TokenHash')),
    created: computed(() => this.ngxSignalTranslate.translate('Created')),
    expires: computed(() => this.ngxSignalTranslate.translate('Expires')),
    userAgent: computed(() => this.ngxSignalTranslate.translate('UserAgent')),
    revoke: computed(() => this.ngxSignalTranslate.translate('Revoke')),
  };
  public readonly accessToken = input.required<AccessTokenModel>();
  public readonly revokeAccessToken = output<string>();

  protected onRevokeAccessToken(tokenHash: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.RevokeAccessToken'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.revokeAccessToken.emit(tokenHash));
  }
}
