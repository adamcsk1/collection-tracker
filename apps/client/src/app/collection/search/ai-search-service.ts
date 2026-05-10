import { effect, inject, Injectable, signal } from '@angular/core';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { ApiService } from '@services/api/api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_USE_AI_SEARCH } from '@shared/constants/storage-const';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { mainStateToken } from '../../main/main-store';

@Injectable()
export class AiSearchService {
  private readonly api = inject(ApiService);
  private readonly webstorage = inject(WebstorageService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly mainState = inject(mainStateToken);
  public readonly searchInProgress = signal(false);
  public readonly useAiSearch = signal<boolean | null>(null);

  constructor() {
    effect(() => {
      if (this.useAiSearch() === null) {
        const storedValue = this.webstorage.getItem(STORAGE_USE_AI_SEARCH);
        this.useAiSearch.set(storedValue === 'true');
      }

      this.webstorage.setItem(STORAGE_USE_AI_SEARCH, String(this.useAiSearch()));
    });

    let previousAiAvailable = this.mainState.state.aiAvailable();
    effect(() => {
      const aiAvailable = this.mainState.state.aiAvailable();
      if (!aiAvailable && previousAiAvailable && this.useAiSearch()) {
        this.useAiSearch.set(false);
        this.webstorage.removeItem(STORAGE_USE_AI_SEARCH);
      }
      previousAiAvailable = aiAvailable;
    });
  }

  public getMatchedIds(searchText: string): Observable<string[] | null> {
    if (!this.useAiSearch() || !searchText) return of(null);

    this.searchInProgress.set(true);
    this.spinnerLoadingState.setState('show', true);

    return this.api.getAiQueryData(searchText).pipe(
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
