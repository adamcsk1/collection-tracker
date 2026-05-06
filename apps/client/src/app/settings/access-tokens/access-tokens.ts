import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TokenDialog } from '../token-dialog/token-dialog';
import { TokenItem } from './token-item/token-item';

import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { AccessTokensApiResponseModel } from '@shared/models/api-model';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'ct-access-tokens',
  imports: [TokenItem, NgxSignalTranslatePipe],
  templateUrl: './access-tokens.html',
  styleUrl: './access-tokens.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessTokens implements OnInit {
  private readonly api = inject(ApiService);
  private readonly confirm = inject(ConfirmService);
  private readonly portal = inject(PortalService);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly accessTokens = signal<AccessTokensApiResponseModel>([]);

  public ngOnInit(): void {
    this.loadAccessTokens();
  }

  protected onRevokeAccessToken(tokenHash: string): void {
    this.api
      .deleteAccessToken(tokenHash)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AccessTokenRevoked'));
        this.loadAccessTokens();
      });
  }

  protected onCreateAccessToken(): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.CreateNewAccessToken'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.api
          .createAccessToken()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((response) => {
            this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AccessTokenCreated'));
            this.portal.open(TokenDialog, {
              title: this.ngxSignalTranslate.translate('Title.NewAccessToken'),
              message: this.ngxSignalTranslate.translate('Message.AccessTokenCreated'),
              token: response.accessToken,
            });
            this.loadAccessTokens();
          });
      });
  }

  private loadAccessTokens(): void {
    this.api
      .getAccessTokens()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => this.accessTokens.set(response));
  }
}
