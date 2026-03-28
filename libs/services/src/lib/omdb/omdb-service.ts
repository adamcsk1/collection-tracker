import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { AlertService } from '@services/alert-service';
import { ApiService } from '@services/api/api-service';
import { getIMDbId } from '@services/omdb/get-imdb-id-util';
import { OMDbResponseItemModel } from '@shared/models/omdb-model';
import { SelectInputModel } from '@shared/models/select-model';
import { catchError, EMPTY, Observable } from 'rxjs';

@Injectable()
export class OMDbService {
  private readonly alert = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private searchText = '';
  private IMDbId: string | null = null;
  private readonly _matchedContent = signal<SelectInputModel>([]);
  private readonly _selectedContent = signal<OMDbResponseItemModel | null>(null);
  public readonly matchedContent = this._matchedContent.asReadonly();
  public readonly selectedContent = this._selectedContent.asReadonly();
  public readonly selectedContent$ = toObservable(this.selectedContent);

  public getMatchedContents(searchText: string): void {
    this.searchText = searchText;
    this.IMDbId = getIMDbId(this.searchText) || null;

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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => this._selectedContent.set(response));

    return this.selectedContent$;
  }

  private fetchOMDbData(): void {
    if (this.IMDbId) this._matchedContent.set([{ text: `IMDb id: ${this.IMDbId}`, value: this.IMDbId }]);
    else {
      this.api
        .getOMDbSearchData({ s: this.searchText })
        .pipe(
          catchError(() => {
            this._selectedContent.set({} as OMDbResponseItemModel);
            return EMPTY;
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((response) => {
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
        });
    }
  }
}
