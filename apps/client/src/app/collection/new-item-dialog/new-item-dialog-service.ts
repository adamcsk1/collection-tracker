import { effect, inject, Injectable } from '@angular/core';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { PortalService } from '@services/portal-service';
import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { parseGenreText, parseTagText } from '@shared/utils/collection-item-text-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, filter, map, mergeMap, skip, take, tap, throwError } from 'rxjs';
import { CollectionService } from '../collection-service';
import { SaveMode } from './new-item-dialog-model';

@Injectable()
export class NewItemDialogService {
  private readonly api = inject(ApiService);
  private readonly omdb = inject(OMDbService);
  private readonly collection = inject(CollectionService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);

  constructor() {
    effect(() => {
      this.matchedContent();
      this.spinnerLoadingState.setState('show', false);
    });
  }

  readonly matchedContent = this.omdb.matchedContent;

  public search(searchText: string): void {
    this.spinnerLoadingState.setState('show', true);
    this.omdb.getMatchedContents(searchText);
  }

  public save(selectedIMDbId: string, tags: string, mode: SaveMode, targetOwnerShareCode?: string) {
    return this.omdb.getSelectedContent(selectedIMDbId).pipe(
      skip(1),
      take(1),
      filter((selectedContent) => !!selectedContent),
      filter((selectedContent) => !!selectedContent?.imdbID),
      map(
        (selectedContent): CollectionItemChangeApiModel => ({
          image: selectedContent.Poster,
          title: selectedContent.Title,
          genre: parseGenreText(selectedContent.Genre),
          IMDbId: selectedContent.imdbID,
          tags: [`#${selectedContent.Type.toLowerCase()}`, ...parseTagText(tags)],
          year: Number(selectedContent.Year) || null,
          rate: selectedContent.imdbRating,
          actors: selectedContent.Actors,
          plot: selectedContent.Plot,
        })
      ),
      tap(() => this.spinnerLoadingState.setState('show', true)),
      mergeMap((collectionItem) =>
        this.api.create(collectionItem, targetOwnerShareCode).pipe(map((response) => response.item))
      ),
      catchError((error) => {
        this.spinnerLoadingState.setState('show', false);
        return throwError(() => error);
      }),
      tap((collectionItem) => {
        this.spinnerLoadingState.setState('show', false);
        this.collection.addCollectionItem(collectionItem, true);
        this.collection.triggerReload();
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.NewItem'));
        if (mode === 'close') this.portal.close();
      })
    );
  }
}
