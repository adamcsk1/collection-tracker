import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { UserShareGrantApiModel, UserSharesApiResponseModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, finalize, Observable, switchMap, tap } from 'rxjs';
import { sharesStateToken } from './shares-store';

@Injectable()
export class SharesService {
  private readonly api = inject(ApiService);
  private readonly sharesState = inject(sharesStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);

  public loadShares(): void {
    if (this.sharesState.state.mutating()) return;
    const requestId = this.sharesState.state.requestId() + 1;
    this.sharesState.setState('requestId', requestId);
    this.api
      .getShares()
      .pipe(
        tap((result) => {
          if (requestId === this.sharesState.state.requestId()) this.storeShares(result);
        }),
        catchError(() => {
          if (requestId === this.sharesState.state.requestId()) this.sharesState.setState('loaded', true);
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  public saveShare(sharedWithUserShareCode: string, grants: UserShareGrantApiModel[]): void {
    this.mutateShares(
      () => this.api.saveShare({ sharedWithUserShareCode, grants }),
      () => {
        const outgoing = this.sharesState.state.outgoing();
        const existing = outgoing.find((share) => share.sharedWithUserShareCode === sharedWithUserShareCode);
        const savedShare = {
          sharedWithUserShareCode,
          sharedWithUsername: existing?.sharedWithUsername ?? null,
          grants,
        };
        this.sharesState.setState(
          'outgoing',
          existing
            ? outgoing.map((share) => (share.sharedWithUserShareCode === sharedWithUserShareCode ? savedShare : share))
            : [...outgoing, savedShare]
        );
      },
      'Toast.ShareSaved'
    );
  }

  private storeShares(result: UserSharesApiResponseModel): void {
    this.sharesState.setState('loaded', true);
    this.sharesState.setState('userShareCode', result.userShareCode);
    this.sharesState.setState('outgoing', result.outgoing);
    this.sharesState.setState('incoming', result.incoming);
  }

  public removeShare(sharedWithUserShareCode: string): void {
    this.mutateShares(
      () => this.api.deleteShare(sharedWithUserShareCode),
      () => {
        this.sharesState.setState(
          'outgoing',
          this.sharesState.state.outgoing().filter((share) => share.sharedWithUserShareCode !== sharedWithUserShareCode)
        );
      },
      'Toast.ShareRemoved'
    );
  }

  public revokeIncomingShare(ownerUserShareCode: string): void {
    this.mutateShares(
      () => this.api.revokeIncomingShare(ownerUserShareCode),
      () => {
        this.sharesState.setState(
          'incoming',
          this.sharesState.state.incoming().filter((share) => share.ownerUserShareCode !== ownerUserShareCode)
        );
      },
      'Toast.ShareRemoved'
    );
  }

  private mutateShares(request: () => Observable<void>, updateLocalState: () => void, toastKey: string): void {
    if (this.sharesState.state.mutating()) return;
    this.sharesState.setState('mutating', true);
    this.sharesState.setState('requestId', this.sharesState.state.requestId() + 1);
    request()
      .pipe(
        tap(() => {
          updateLocalState();
          this.sharesState.setState('loaded', false);
          this.toastState.setState('message', this.ngxSignalTranslate.translate(toastKey));
        }),
        switchMap(() => this.api.getShares()),
        tap((result) => this.storeShares(result)),
        catchError(() => EMPTY),
        finalize(() => this.sharesState.setState('mutating', false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }
}
