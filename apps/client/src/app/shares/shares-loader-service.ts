import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '@services/api/api-service';
import { catchError, EMPTY, of, tap } from 'rxjs';
import { sharesStateToken } from './shares-store';

@Injectable()
export class SharesLoaderService {
  private readonly api = inject(ApiService);
  private readonly sharesState = inject(sharesStateToken);

  public load(destroyRef: DestroyRef, fallbackToEmptyShares = false): void {
    if (this.sharesState.state.loaded() || this.sharesState.state.mutating()) return;
    const requestId = this.sharesState.state.requestId() + 1;
    this.sharesState.setState('requestId', requestId);

    this.api
      .getShares()
      .pipe(
        tap((result) => {
          if (requestId !== this.sharesState.state.requestId()) return;
          this.sharesState.setState('loaded', true);
          this.sharesState.setState('userShareCode', result.userShareCode);
          this.sharesState.setState('outgoing', result.outgoing);
          this.sharesState.setState('incoming', result.incoming);
        }),
        catchError(() => {
          if (requestId === this.sharesState.state.requestId()) this.sharesState.setState('loaded', true);
          return fallbackToEmptyShares ? of({ userShareCode: '', outgoing: [], incoming: [] }) : EMPTY;
        }),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe();
  }
}
