import { inject, Injectable, signal } from '@angular/core';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { ApiService } from '@services/api/api-service';
import { CollectionListTypeModel } from '@shared/models/api-model';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { mainStateToken } from '../../main/main-store';

@Injectable()
export class AiSearchService {
  private readonly api = inject(ApiService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly mainState = inject(mainStateToken);
  private readonly listType = signal<CollectionListTypeModel>('library');
  public readonly searchInProgress = signal(false);

  public setListType(listType: CollectionListTypeModel): void {
    this.listType.set(listType);
  }

  public getMatchedIds(searchText: string): Observable<string[] | null> {
    if (!searchText) return of(null);

    this.searchInProgress.set(true);
    this.spinnerLoadingState.setState('show', true);

    return this.api.getAiQueryData(searchText, this.listType()).pipe(
      map((result) => result.matchedIds),
      tap(() => this.spinnerLoadingState.setState('show', false)),
      tap(() => this.searchInProgress.set(false)),
      catchError(() => {
        this.spinnerLoadingState.setState('show', false);
        this.searchInProgress.set(false);
        return of(null);
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
