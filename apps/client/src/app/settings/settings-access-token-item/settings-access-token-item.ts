import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ConfirmService } from '@services/confirm-service';
import { AccessTokenModel } from '@shared/models/api-model';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'ct-settings-access-token-item',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe, DatePipe],
  templateUrl: './settings-access-token-item.html',
  styleUrl: './settings-access-token-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAccessTokenItem {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmService);
  public readonly accessToken = input.required<AccessTokenModel>();
  public readonly revokeAccessToken = output<string>();

  protected onRevokeAccessToken(tokenHash: string): void {
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.RevokeAccessToken'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirm) => {
        if (confirm) this.revokeAccessToken.emit(tokenHash);
      });
  }
}
