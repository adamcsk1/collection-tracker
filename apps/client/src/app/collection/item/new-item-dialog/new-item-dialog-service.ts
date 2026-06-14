import { effect, inject, Injectable } from '@angular/core';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { PortalService } from '@services/portal-service';
import { MOVIE_TAG, SERIES_TAG } from '@shared/constants/tags-const';
import { CollectionItemChangeApiModel, CollectionListTypeModel } from '@shared/models/api-model';
import { CollectionItemYearModel } from '@shared/models/collection-item-model';
import { parseGenreText, parseTagText } from '@shared/utils/collection-item-text-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, filter, map, mergeMap, skip, take, tap, throwError } from 'rxjs';
import { CollectionService } from '../../collection-service';
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
  public readonly matchedContent = this.omdb.matchedContent;

  constructor() {
    effect(() => {
      this.matchedContent();
      this.spinnerLoadingState.setState('show', false);
    });
  }

  public search(searchText: string): void {
    this.spinnerLoadingState.setState('show', true);
    this.omdb.getMatchedContents(searchText);
  }

  public save(
    selectedIMDbId: string,
    userRate: number | null,
    tags: string,
    mode: SaveMode,
    targetOwnerShareCode?: string,
    listType: CollectionListTypeModel = 'library',
    fetchSeriesMetadata?: boolean
  ) {
    return this.omdb.getSelectedContent(selectedIMDbId).pipe(
      skip(1),
      take(1),
      filter((selectedContent) => !!selectedContent),
      filter((selectedContent) => !!selectedContent?.imdbID),
      map((selectedContent): CollectionItemChangeApiModel => {
        const selectedContentType = selectedContent.Type.trim().toLowerCase();
        if (listType === 'series-tracker' && selectedContentType !== 'series') {
          throw new Error('Series tracker items must be series.');
        }
        const typeTag = selectedContentType === 'movie' ? MOVIE_TAG : SERIES_TAG;
        return {
          image: selectedContent.Poster,
          title: selectedContent.Title,
          genre: parseGenreText(selectedContent.Genre),
          IMDbId: selectedContent.imdbID,
          tags: typeTag ? [typeTag, ...parseTagText(tags)] : parseTagText(tags),
          year: this.parseYear(selectedContent.Year),
          rate: selectedContent.imdbRating,
          rottenTomatoesRate: this.getRating(selectedContent.Ratings, 'Rotten Tomatoes'),
          metacriticRate: this.getRating(selectedContent.Ratings, 'Metacritic'),
          userRate,
          actors: selectedContent.Actors,
          plot: selectedContent.Plot,
        };
      }),
      tap(() => this.spinnerLoadingState.setState('show', true)),
      mergeMap((collectionItem) =>
        (listType === 'library'
          ? this.api.create(collectionItem, targetOwnerShareCode)
          : this.api.create(collectionItem, targetOwnerShareCode, listType, fetchSeriesMetadata)
        ).pipe(map((response) => response.item))
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
        if (mode === 'close') this.portal.closeAll();
      })
    );
  }

  private parseYear(year: string): CollectionItemYearModel {
    const normalizedYear = year.trim().replace('–', '-');
    const normalizedDecimalYear = normalizedYear.replace(/^(\d{4})\.0$/, '$1');
    return normalizedDecimalYear && normalizedDecimalYear !== 'N/A' ? normalizedDecimalYear : null;
  }

  private getRating(ratings: { Source: string; Value: string }[] | undefined, source: string): string {
    return ratings?.find((rating) => rating.Source === source)?.Value.trim() ?? '';
  }
}
