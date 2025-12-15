import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CollectionModel } from '@client/collection/collection-model';
import { CollectionService } from '@client/collection/collection-service';
import { getCollectionItem } from '@client/collection/utils/get-collection-item-util';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { ParserModel, TemplateRefreshStateModel } from '@client/parser/parser-model';
import { PARSER_PREVIEW_OMDB_RESPONSE } from '@client/parser/parser-preview-const';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { AlertService } from '@services/alert-service';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { MdContentGeneratorService } from '@services/md-content-generator/md-content-generator-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { WindowParserCacheModel } from '@services/parser/parser-model';
import { ParserService as MainParserService } from '@services/parser/parser-service';
import { setParserRegexp, setParserTemplate } from '@services/parser/parser-util';
import { restoreSerializedParserRegexp } from '@shared/utils/parser-serialize-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, delay, filter, map, mergeMap, skip, take, tap, throwError } from 'rxjs';

@Injectable()
export class ParserService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly mainParserService = inject(MainParserService);
  private readonly collection = inject(CollectionService);
  private readonly mdContentGenerator = inject(MdContentGeneratorService);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly omdb = inject(OMDbService);
  private readonly api = inject(ApiService);
  private readonly toastState = inject(toastStateToken);
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  private readonly _state = signal<TemplateRefreshStateModel>({
    running: false,
    count: 0,
    checked: 0,
    errors: 0,
  });
  private collectionList!: CollectionModel;
  public readonly state = this._state.asReadonly();

  public storeFormData(formData: ParserModel): void {
    this.spinnerLoadingState.setState('show', true);
    this.setParserCache(formData);

    this.mainParserService
      .syncUserParserConfig()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error) => {
          this.spinnerLoadingState.setState('show', false);
          return throwError(() => error);
        }),
        tap(() => this.spinnerLoadingState.setState('show', false)),
        delay(500),
        tap(() => {
          this.collection.loadCollection();
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.ParserSettingsSaved'));
        }),
        delay(500)
      )
      .subscribe();
  }

  public generatePreviewContent(formData: ParserModel): void {
    const originalParserCache = structuredClone((window as WindowParserCacheModel).__parserCache);
    try {
      this.setParserCache(formData);
      const mdContentPreview = this.mdContentGenerator.getMdContent(PARSER_PREVIEW_OMDB_RESPONSE);

      const parsedCollectionItem = getCollectionItem({ content: mdContentPreview, name: '' });

      (window as WindowParserCacheModel).__parserCache = originalParserCache;
      this.alert.show(
        `${this.ngxSignalTranslate.translate('TemplatePreview')}\n\n ${mdContentPreview}\n\n${this.ngxSignalTranslate.translate('ParsedAttributes')}\n\n${JSON.stringify({ ...parsedCollectionItem, rawContent: undefined, name: undefined }, null, 2)}`
      );
    } catch {
      (window as WindowParserCacheModel).__parserCache = originalParserCache;
      this.alert.show(this.ngxSignalTranslate.translate('Message.PreviewGenerationError'));
    }
  }

  public regenerateTemplates(): void {
    this.confirm.open(this.ngxSignalTranslate.translate('Confirm.TemplateRegeneration')).subscribe((confirmed) => {
      if (!confirmed) return;
      this.blockerLoadingState.patchState('withoutDelay', true);
      this.blockerLoadingState.patchState('show', true);

      this._state.set({
        running: true,
        count: this.mainCollectionState.state.collection().length,
        checked: 0,
        errors: 0,
      });

      this.collectionList = this.mainCollectionState.state.collection().toReversed();
      this.regenerateNextTemplate(0);
    });
  }

  private regenerateNextTemplate(index: number): void {
    this.blockerLoadingState.patchState(
      'message',
      this.ngxSignalTranslate.translate('Message.RegeneratingTemplates', {
        count: `${this._state().count - this._state().checked}`,
      })
    );

    if (index >= this.collectionList.length) {
      this._state.update((state) => ({
        ...state,
        running: false,
      }));

      this.collection.loadCollection();
      this.blockerLoadingState.patchState('show', false);

      if (this.state().errors > 0) {
        this.toastState.setState('timeout', 10000);
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TemplatesRegeneratedWithErrors'));
      } else {
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TemplatesRegenerated'));
      }
      return;
    }

    this.omdb
      .getSelectedContent(this.collectionList[index].IMDbId)
      .pipe(
        skip(1),
        take(1),
        delay(500),
        map((omdbItem) => {
          if (!!omdbItem?.imdbID) {
            return this.mdContentGenerator.getMdContent({
              ...omdbItem,
              Tags: this.collectionList[index].tags.filter((tag) => !['#movie', '#series'].includes(tag)).join(' '),
            });
          } else return '';
        }),
        map((mdContent) => {
          if (!mdContent) {
            this._state.update((state) => ({
              ...state,
              checked: state.checked + 1,
              errors: state.errors + 1,
            }));
            this.regenerateNextTemplate(this.collectionList.length);
            return '';
          } else if (mdContent === this.collectionList[index].rawContent) {
            this._state.update((state) => ({
              ...state,
              checked: state.checked + 1,
            }));
            this.regenerateNextTemplate(index + 1);
            return '';
          }

          return mdContent;
        }),
        filter((mdContent) => mdContent.length > 0),
        mergeMap((mdContent) => this.api.update(this.collectionList[index].name, mdContent)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this._state.update((state) => ({
          ...state,
          checked: state.checked + 1,
        }));
        this.regenerateNextTemplate(index + 1);
      });
  }

  private setParserCache(formData: ParserModel): void {
    setParserTemplate(formData.mdTemplate!);
    setParserRegexp('IMDbId', restoreSerializedParserRegexp(formData.IMDbId!));
    setParserRegexp('genre', restoreSerializedParserRegexp(formData.genre!));
    setParserRegexp('genreToken', restoreSerializedParserRegexp(formData.genreToken!));
    setParserRegexp('image', restoreSerializedParserRegexp(formData.image!));
    setParserRegexp('IMDbRate', restoreSerializedParserRegexp(formData.IMDbRate!));
    setParserRegexp('tags', restoreSerializedParserRegexp(formData.tags!));
    setParserRegexp('tagToken', restoreSerializedParserRegexp(formData.tagToken!));
    setParserRegexp('title', restoreSerializedParserRegexp(formData.title!));
    setParserRegexp('year', restoreSerializedParserRegexp(formData.year!));
  }
}
