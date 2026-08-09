import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { UserShareGrantApiModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, tap } from 'rxjs';
import { sharesStateToken } from './shares-store';

@Injectable()
export class SharesService {
  private readonly api = inject(ApiService);
  private readonly sharesState = inject(sharesStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);

  public loadShares(): void {
    this.api
      .getShares()
      .pipe(
        tap((result) => {
          this.sharesState.setState('loaded', true);
          this.sharesState.setState('userShareCode', result.userShareCode);
          this.sharesState.setState('outgoing', result.outgoing);
          this.sharesState.setState('incoming', result.incoming);
        }),
        catchError(() => {
          this.sharesState.setState('loaded', true);
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  public saveShare(sharedWithUserShareCode: string, grants: UserShareGrantApiModel[]): void {
    this.api
      .saveShare({ sharedWithUserShareCode, grants })
      .pipe(
        tap(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.ShareSaved'));
          this.loadShares();
        }),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  public removeShare(sharedWithUserShareCode: string): void {
    this.api
      .deleteShare(sharedWithUserShareCode)
      .pipe(
        tap(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.ShareRemoved'));
          this.loadShares();
        }),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  public revokeIncomingShare(ownerUserShareCode: string): void {
    this.api
      .revokeIncomingShare(ownerUserShareCode)
      .pipe(
        tap(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.ShareRemoved'));
          this.loadShares();
        }),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }
}
