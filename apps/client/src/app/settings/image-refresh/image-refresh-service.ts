import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { CollectionItemModel } from '@client/collection/collection-model';
import { CollectionService } from '@client/collection/collection-service';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { ImageRefreshStateModel } from '@client/settings/image-refresh/image-refresh-model';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, map, mergeMap, Observable, of, skip, take, tap } from 'rxjs';

@Injectable()
export class ImageRefreshService {
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly omdb = inject(OMDbService);
  private readonly api = inject(ApiService);
  private readonly collection = inject(CollectionService);
  private readonly confirm = inject(ConfirmService);
  private readonly httpClient = inject(HttpClient);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly _state = signal<ImageRefreshStateModel>({
    running: false,
    count: 0,
    checked: 0,
    fixed: 0,
    errors: 0,
  });
  public readonly state = this._state.asReadonly();

  public refreshImages(): void {
    this.confirm.ifConfirmed(this.ngxSignalTranslate.translate('Confirm.ImageRefresh')).subscribe(() => {
      this._state.set({
        running: true,
        count: this.mainCollectionState.state.collection().length,
        checked: 0,
        fixed: 0,
        errors: 0,
      });

      this.blockerLoadingState.patchState('withoutDelay', true);
      this.blockerLoadingState.patchState('show', true);
      this.checkImageAvailability(0);
    });
  }

  private checkImageAvailability(index: number): void {
    this.blockerLoadingState.patchState(
      'message',
      this.ngxSignalTranslate.translate('Message.RefreshImages', {
        count: `${this._state().count - this._state().checked}`,
      }),
    );

    const collectionItem = this.mainCollectionState.state.collection()[index];
    this.httpClient
      .get(collectionItem.image, {
        responseType: 'text',
      })
      .pipe(
        take(1),
        map(() => true),
        catchError(() => this.fetchMovieDetails(collectionItem)),
        tap((status) =>
          this._state.update((state) => ({
            ...state,
            checked: state.checked + 1,
            fixed: !status ? state.fixed + 1 : state.fixed,
          }))
        ),
      )
      .subscribe(() => this.next(index));
  }

  private fetchMovieDetails(collectionItem: CollectionItemModel): Observable<boolean | void> {
    return this.omdb.getSelectedContent(collectionItem.IMDbId).pipe(
      skip(1),
      take(1),
      mergeMap((omdbItem) => {
        if (!!omdbItem?.imdbID) {
          return this.api.update(
            collectionItem.name,
            collectionItem.rawContent.replace(collectionItem.image, omdbItem.Poster),
            collectionItem.hash,
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
      }),
    );
  }

  private next(index: number): void {
    if (index < this.mainCollectionState.state.collection().length - 1) this.checkImageAvailability(index + 1);
    else {
      this._state.update((state) => ({
        ...state,
        running: false,
      }));

      this.collection.loadCollection();
      this.blockerLoadingState.patchState('show', false);

      if (this.state().errors > 0) {
        this.toastState.setState('timeout', 10000);
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.ImagesRegeneratedWithErrors'));
      } else {
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.ImagesRegenerated'));
      }
    }
  }
}
