import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { OMDbResponseItemModel } from '@shared/models/omdb-model';
import { SelectInputModel } from '@shared/models/select-model';
import { getIMDbId } from '@shared/omdb/get-imdb-id-util';
import { catchError, EMPTY, Observable } from 'rxjs';
import { AlertService } from '../alert-service';
import { ApiService } from '../api/api-service';

@Injectable()
export class OMDbService {
  private readonly alert = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private searchText = '';
  private IMDbId: string | null = null;
  private searchRequestId = 0;
  private readonly _matchedContent = signal<SelectInputModel>([]);
  private readonly _selectedContent = signal<OMDbResponseItemModel | null>(null);
  private readonly _completedSearchText = signal('');
  public readonly matchedContent = this._matchedContent.asReadonly();
  public readonly selectedContent = this._selectedContent.asReadonly();
  public readonly completedSearchText = this._completedSearchText.asReadonly();
  public readonly selectedContent$ = toObservable(this.selectedContent);

  public getMatchedContents(searchText: string): void {
    this.searchText = searchText;
    this.IMDbId = getIMDbId(this.searchText) || null;
    this.searchRequestId++;
    this._completedSearchText.set('');

    this.fetchOMDbData();
  }

  public getSelectedContent(IMDbId: string): Observable<OMDbResponseItemModel | null> {
    this.IMDbId = IMDbId;

    this.api
      .getOMDbData({ i: this.IMDbId })
      .pipe(
        catchError(() => {
          this._selectedContent.set({} as OMDbResponseItemModel);
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => this._selectedContent.set(response));

    return this.selectedContent$;
  }

  private fetchOMDbData(): void {
    if (this.IMDbId) this._matchedContent.set([{ text: `IMDb id: ${this.IMDbId}`, value: this.IMDbId }]);
    else {
      const searchText = this.searchText.trim();
      const searchRequestId = this.searchRequestId;
      this.api
        .getOMDbSearchData({ s: searchText })
        .pipe(
          catchError(() => {
            this._selectedContent.set({} as OMDbResponseItemModel);
            return EMPTY;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((response) => {
          if (searchRequestId !== this.searchRequestId) return;

          const result: SelectInputModel = [];
          if (Array.isArray(response?.Search)) {
            for (const responseItem of response.Search) {
              result.push({
                text: `(${responseItem.Type}) ${responseItem.Title} (${responseItem.Year})`,
                value: responseItem.imdbID,
              });
            }
          }

          this._matchedContent.set(result);
          this._completedSearchText.set(searchText);
        });
    }
  }
}
