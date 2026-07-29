import { effect, inject, Injectable } from '@angular/core';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ExternalMetadataService } from '@services/external-metadata/external-metadata-service';
import { PortalService } from '@services/portal-service';
import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { CollectionItemYearModel } from '@shared/models/collection-item-model';
import { ExternalMetadataReferenceModel } from '@shared/models/external-metadata-model';
import { getImdbIdFromExternalMetadata } from '@shared/utils/external-metadata-identity-util';
import { getExternalMetadataRating } from '@shared/utils/external-metadata-ratings-util';
import { parseTagText } from '@shared/utils/collection-item-text-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, filter, map, mergeMap, of, skip, take, tap, throwError } from 'rxjs';
import { CollectionService } from '../../collection-service';
import { SaveMode, SaveOptions } from './new-item-dialog-model';

@Injectable()
export class NewItemDialogService {
  private readonly api = inject(ApiService);
  private readonly externalMetadata = inject(ExternalMetadataService);
  private readonly collection = inject(CollectionService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);
  public readonly matchedContent = this.externalMetadata.matchedContent;
  public readonly completedSearchText = this.externalMetadata.completedSearchText;

  constructor() {
    effect(() => {
      this.matchedContent();
      this.spinnerLoadingState.setState('show', false);
    });
  }

  public search(searchText: string): void {
    this.spinnerLoadingState.setState('show', true);
    this.externalMetadata.getMatchedContents(searchText);
  }

  public getProviderReference(selectedExternalMetadataValue: string | null): ExternalMetadataReferenceModel | null {
    return this.externalMetadata.getProviderReference(selectedExternalMetadataValue);
  }

  public save(
    selectedExternalMetadataValue: string,
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

    return this.externalMetadata.getSelectedContent(selectedExternalMetadataValue).pipe(
      skip(1),
      take(1),
      filter((selectedContent) => !!selectedContent),
      filter((selectedContent) => !!selectedContent?.providerItemId),
      map(
        (
          selectedContent
        ): {
          item: CollectionItemChangeApiModel;
          selectedContentIsMovie: boolean;
          selectedContentIsSeries: boolean;
        } => {
          const selectedContentType = selectedContent.contentType;
          if (listType === 'series-tracker' && selectedContentType !== 'series') {
            throw new Error('Series tracker items must be series.');
          }
          if (listType === 'movie-tracker' && selectedContentType !== 'movie') {
            throw new Error('Movie tracker items must be movies.');
          }
          return {
            item: {
              image: selectedContent.poster,
              title: selectedContent.title,
              genre: selectedContent.genres,
              IMDbId: getImdbIdFromExternalMetadata(selectedContent),
              externalProvider: selectedContent.provider,
              externalItemId: selectedContent.providerItemId,
              externalIds: selectedContent.externalIds,
              tags: parseTagText(tags),
              year: this.parseYear(selectedContent.year),
              rate: getExternalMetadataRating(selectedContent.ratings, 'Internet Movie Database'),
              rottenTomatoesRate: getExternalMetadataRating(selectedContent.ratings, 'Rotten Tomatoes'),
              metacriticRate: getExternalMetadataRating(selectedContent.ratings, 'Metacritic'),
              userRate,
              actors: selectedContent.actors,
              plot: selectedContent.plot,
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
          return this.api
            .addMovieTrackerItemByExternalId(
              collectionItem.externalProvider,
              collectionItem.externalItemId,
              targetOwnerShareCode
            )
            .pipe(
              map((response) => ({
                collectionItem: { ...collectionItem, watched: true },
                movieTrackerItem: response.item,
                seriesTrackerItem: null,
              }))
            );
        }

        if (listType === 'library' && copyToSeriesTrackerAsWatched && selectedContentIsSeries) {
          return this.api
            .addSeriesTrackerItemByExternalId(
              collectionItem.externalProvider,
              collectionItem.externalItemId,
              undefined,
              targetOwnerShareCode
            )
            .pipe(
              mergeMap((response) =>
                this.api
                  .markAllSeriesTrackerWatchedByExternalId(
                    collectionItem.externalProvider,
                    collectionItem.externalItemId
                  )
                  .pipe(
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
}
