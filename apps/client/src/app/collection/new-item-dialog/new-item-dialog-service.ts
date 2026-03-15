import { effect, inject, Injectable } from '@angular/core';
import { CollectionService } from '@client/collection/collection-service';
import { SaveMode } from '@client/collection/new-item-dialog/new-item-dialog-model';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { MdContentGeneratorService } from '@services/md-content-generator/md-content-generator-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { buildCollectionItemFilename } from '@services/parser/utils/filename-pattern-util';
import { PortalService } from '@services/portal-service';
import { getParserFilenamePattern } from '@services/parser/parser-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, filter, map, mergeMap, skip, take, tap, throwError } from 'rxjs';

@Injectable()
export class NewItemDialogService {
  private readonly api = inject(ApiService);
  private readonly omdb = inject(OMDbService);
  private readonly collection = inject(CollectionService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly mdContentGenerator = inject(MdContentGeneratorService);
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

  public save(selectedIMDbId: string, tags: string, mode: SaveMode) {
    return this.omdb.getSelectedContent(selectedIMDbId).pipe(
      skip(1),
      take(1),
      filter((selectedContent) => !!selectedContent),
      filter((selectedContent) => !!selectedContent?.imdbID),
      map((selectedContent) => ({
        content: this.mdContentGenerator.getMdContent({
          ...selectedContent,
          Tags: tags.trim(),
        }),
        name: buildCollectionItemFilename({
          pattern: getParserFilenamePattern(),
          selectedContent,
        }),
      })),
      tap(() => this.spinnerLoadingState.setState('show', true)),
      mergeMap((collectionItem) =>
        this.api
          .create(collectionItem.content, collectionItem.name)
          .pipe(map((response) => ({ name: response.name, content: collectionItem.content })))
      ),
      catchError((error) => {
        this.spinnerLoadingState.setState('show', false);
        return throwError(() => error);
      }),
      tap((collectionItem) => {
        this.spinnerLoadingState.setState('show', false);
        this.collection.addCollectionItem(collectionItem, true);
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.NewItem'));
        if (mode === 'close') this.portal.close();
      })
    );
  }
}
