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
    if (this.sharesState.state.loaded()) return;

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
          return fallbackToEmptyShares ? of({ userShareCode: '', outgoing: [], incoming: [] }) : EMPTY;
        }),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe();
  }
}
