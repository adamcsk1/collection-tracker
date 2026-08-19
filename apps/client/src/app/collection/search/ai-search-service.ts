import { inject, Injectable, signal } from '@angular/core';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { ApiService } from '@services/api/api-service';
import { CollectionListTypeModel } from '@shared/models/api-model';
import { catchError, concat, finalize, map, Observable, of, tap } from 'rxjs';
import { mainStateToken } from '../../main/main-store';
import type { AiSearchResult } from './ai-search-model';

@Injectable()
export class AiSearchService {
  private readonly api = inject(ApiService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly mainState = inject(mainStateToken);
  public readonly searchInProgress = signal(false);

  public getMatchedIds(searchText: string, listType: CollectionListTypeModel): Observable<AiSearchResult> {
    if (!searchText) return of({ status: 'idle' });

    this.searchInProgress.set(true);
    this.spinnerLoadingState.setState('show', true);

    return concat(
      of<AiSearchResult>({ status: 'pending' }),
      this.api.getAiQueryData(searchText, listType).pipe(
        map((result): AiSearchResult => ({ status: 'success', matchedIds: result.matchedIds })),
        catchError(() => of<AiSearchResult>({ status: 'error' }))
      )
    ).pipe(
      finalize(() => {
        this.spinnerLoadingState.setState('show', false);
        this.searchInProgress.set(false);
      })
    );
  }

  public checkAiAvailable(): Observable<boolean> {
    return this.api.getAiAvailable().pipe(
      map((result) => result.aiAvailable),
      tap((available) => this.mainState.setState('aiAvailable', available)),
      catchError(() => {
        this.mainState.setState('aiAvailable', false);
        return of(false);
      })
    );
  }
}
