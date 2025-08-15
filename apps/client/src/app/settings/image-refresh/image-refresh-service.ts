import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { CollectionItemModel } from '@client/collection/collection-model';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { ImageRefreshState } from '@client/settings/image-refresh/image-refresh-model';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { OMDbService } from '@services/omdb/omdb-service';
import { catchError, EMPTY, map, mergeMap, Observable, of, skip, take, tap } from 'rxjs';

@Injectable()
export class ImageRefreshService {
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly omdb = inject(OMDbService);
  private readonly api = inject(ApiService);
  private readonly httpClient = inject(HttpClient);
  private readonly _state = signal<ImageRefreshState>({
    running: false,
    count: 0,
    checked: 0,
    fixed: 0,
    errors: 0,
  });
  public readonly state = this._state.asReadonly();

  public refreshImages(): void {
    this._state.set({
      running: true,
      count: this.mainCollectionState.state.collection().length,
      checked: 0,
      fixed: 0,
      errors: 0,
    });

    if (this._state().count !== 0) this.checkImageAvailability(0);
  }

  private checkImageAvailability(index: number): void {
    const collectionItem = this.mainCollectionState.state.collection()[index];
    this.httpClient
      .get(collectionItem.image, {
        responseType: 'text',
      })
      .pipe(
        map(() => true),
        catchError(() => this.fetchMovieDetails(collectionItem)),
        tap((status) =>
          this._state.update((state) => ({
            ...state,
            checked: state.checked + 1,
            fixed: !status ? state.fixed + 1 : state.fixed,
          }))
        )
      )
      .subscribe(() => this.next(index));
  }

  private fetchMovieDetails(collectionItem: CollectionItemModel): Observable<boolean | void> {
    return this.omdb.getSelectedContent(collectionItem.IMDbId).pipe(
      skip(1),
      take(1),
      mergeMap((omdbItem) => {
        if (!!omdbItem) {
          return this.api.update(
            collectionItem.name,
            collectionItem.rawContent.replace(collectionItem.image, omdbItem.Poster)
          );
        } else return EMPTY;
      }),
      map(() => false),
      catchError(() => {
        this._state.update((state) => ({
          ...state,
          checked: state.checked + 1,
          errors: state.errors + 1,
        }));
        return of(false);
      })
    );
  }

  private next(index: number): void {
    if (index < this.mainCollectionState.state.collection().length - 1) this.checkImageAvailability(index + 1);
    else {
      this._state.update((state) => ({
        ...state,
        running: false,
      }));
      this.apiState.setState('loadNetworkStatus', null);
    }
  }
}
