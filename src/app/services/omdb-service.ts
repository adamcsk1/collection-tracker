import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { SelectInputModel } from '@components/select/select.model';
import { appStateToken } from '@stores/app-store';
import { catchError, Observable } from 'rxjs';
import { AlertService } from './alert-service';
import { getIMDbId } from './collection/utils/get-imdb-id.util';
import { OMDbResponseItemModel, OMDbResponseModel } from './omdb.model';

const OMDB_API = 'https://www.omdbapi.com/';

@Injectable()
export class OMDbService {
  private readonly alert = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly httpClient = inject(HttpClient);
  private readonly appSate = inject(appStateToken);
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

    this.getOMDbData({ i: this.IMDbId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => this._selectedContent.set(response));

    return this.selectedContent$;
  }

  private fetchOMDbData(): void {
    if (this.IMDbId) this._matchedContent.set([{ text: `IMDb id: ${this.IMDbId}`, value: this.IMDbId }]);
    else {
      this.getOMDbSearchData({ s: this.searchText })
        .pipe(takeUntilDestroyed(this.destroyRef))
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

  private getOMDbData(queryParams: { i: string | null }): Observable<OMDbResponseItemModel> {
    const url = new URL(OMDB_API);

    url.searchParams.append('i', `${queryParams.i}`);
    url.searchParams.append('apikey', this.appSate.state.omdbApiKey());

    return this.httpClient.get<OMDbResponseItemModel>(url.href).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }

  private getOMDbSearchData(queryParams: { s: string | null }): Observable<OMDbResponseModel> {
    const url = new URL(OMDB_API);

    url.searchParams.append('s', `${queryParams.s}`);
    url.searchParams.append('apikey', this.appSate.state.omdbApiKey());

    return this.httpClient.get<OMDbResponseModel>(url.href).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }
}
