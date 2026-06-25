import { effect, inject, Injectable } from '@angular/core';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { PortalService } from '@services/portal-service';
import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { CollectionItemYearModel } from '@shared/models/collection-item-model';
import { parseGenreText, parseTagText } from '@shared/utils/collection-item-text-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, filter, map, mergeMap, of, skip, take, tap, throwError } from 'rxjs';
import { CollectionService } from '../../collection-service';
import { SaveMode, SaveOptions } from './new-item-dialog-model';

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
  public readonly completedSearchText = this.omdb.completedSearchText;

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
    options: SaveOptions = {}
  ) {
    const {
      targetOwnerShareCode,
      listType = 'library',
      watched = false,
      copyToSeriesTrackerAsWatched = false,
    } = options;

    return this.omdb.getSelectedContent(selectedIMDbId).pipe(
      skip(1),
      take(1),
      filter((selectedContent) => !!selectedContent),
      filter((selectedContent) => !!selectedContent?.imdbID),
      map(
        (
          selectedContent
        ): {
          item: CollectionItemChangeApiModel;
          selectedContentIsMovie: boolean;
          selectedContentIsSeries: boolean;
        } => {
          const selectedContentType = selectedContent.Type.trim().toLowerCase();
          if (listType === 'series-tracker' && selectedContentType !== 'series') {
            throw new Error('Series tracker items must be series.');
          }
          if (listType === 'movie-tracker' && selectedContentType !== 'movie') {
            throw new Error('Movie tracker items must be movies.');
          }
          return {
            item: {
              image: selectedContent.Poster,
              title: selectedContent.Title,
              genre: parseGenreText(selectedContent.Genre),
              IMDbId: selectedContent.imdbID,
              tags: parseTagText(tags),
              year: this.parseYear(selectedContent.Year),
              rate: selectedContent.imdbRating,
              rottenTomatoesRate: this.getRating(selectedContent.Ratings, 'Rotten Tomatoes'),
              metacriticRate: this.getRating(selectedContent.Ratings, 'Metacritic'),
              userRate,
              actors: selectedContent.Actors,
              plot: selectedContent.Plot,
              contentType: selectedContentType === 'series' ? 'series' : 'movie',
              favorite: false,
            },
            selectedContentIsMovie: selectedContentType === 'movie',
            selectedContentIsSeries: selectedContentType === 'series',
          };
        }
      ),
      tap(() => this.spinnerLoadingState.setState('show', true)),
      mergeMap(({ item, selectedContentIsMovie, selectedContentIsSeries }) =>
        (listType === 'library'
          ? this.api.create(item, targetOwnerShareCode)
          : this.api.create(item, targetOwnerShareCode, listType)
        ).pipe(map((response) => ({ collectionItem: response.item, selectedContentIsMovie, selectedContentIsSeries })))
      ),
      mergeMap(({ collectionItem, selectedContentIsMovie, selectedContentIsSeries }) => {
        if (listType === 'library' && watched && selectedContentIsMovie) {
          return this.api.addMovieTrackerItem(collectionItem.IMDbId, targetOwnerShareCode).pipe(
            map((response) => ({
              collectionItem: { ...collectionItem, watched: true },
              movieTrackerItem: response.item,
              seriesTrackerItem: null,
            }))
          );
        }

        if (listType === 'library' && copyToSeriesTrackerAsWatched && selectedContentIsSeries) {
          return this.api.addSeriesTrackerItem(collectionItem.IMDbId, undefined, targetOwnerShareCode).pipe(
            mergeMap((response) =>
              this.api.markAllSeriesTrackerWatched(collectionItem.IMDbId).pipe(
                map((watchedResponse) => ({
                  collectionItem,
                  movieTrackerItem: null,
                  seriesTrackerItem: watchedResponse.item ?? response.item,
                }))
              )
            )
          );
        }

        return of({ collectionItem, movieTrackerItem: null, seriesTrackerItem: null });
      }),
      catchError((error) => {
        this.spinnerLoadingState.setState('show', false);
        return throwError(() => error);
      }),
      tap(({ collectionItem, movieTrackerItem, seriesTrackerItem }) => {
        this.spinnerLoadingState.setState('show', false);
        this.collection.addCollectionItem(collectionItem, true);
        if (movieTrackerItem) this.collection.addCollectionItem(movieTrackerItem, true);
        if (seriesTrackerItem) this.collection.addCollectionItem(seriesTrackerItem, true);
        this.collection.triggerReload();
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.NewItem'));
        if (mode === 'close') this.portal.closeAll();
      }),
      map(({ collectionItem }) => collectionItem)
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
