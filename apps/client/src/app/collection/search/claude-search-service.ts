import { effect, inject, Injectable, signal } from '@angular/core';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { ApiService } from '@services/api/api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_USE_CLAUDE_AI } from '@shared/constants/storage-const';
import { catchError, map, Observable, of, tap } from 'rxjs';

@Injectable()
export class ClaudeSearchService {
  private readonly api = inject(ApiService);
  private readonly webstorage = inject(WebstorageService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  public readonly searchInProgress = signal(false);
  public readonly useClaudeAi = signal<boolean | null>(null);

  constructor() {
    effect(() => {
      if (this.useClaudeAi() === null) {
        const storedValue = this.webstorage.getItem(STORAGE_USE_CLAUDE_AI);
        this.useClaudeAi.set(storedValue === 'true');
      }

      this.webstorage.setItem(STORAGE_USE_CLAUDE_AI, String(this.useClaudeAi()));
    });
  }

  public getMatchedIds(searchText: string): Observable<string[] | null> {
    if (!this.useClaudeAi() || !searchText) return of(null);

    this.searchInProgress.set(true);
    this.spinnerLoadingState.setState('show', true);

    return this.api.getClaudeQueryData(searchText).pipe(
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
}
