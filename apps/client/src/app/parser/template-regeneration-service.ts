import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CollectionModel } from '@client/collection/collection-model';
import { CollectionService } from '@client/collection/collection-service';
import { TemplateRefreshStateModel } from '@client/parser/parser-model';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { MdContentGeneratorService } from '@services/md-content-generator/md-content-generator-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { delay, filter, map, mergeMap, skip, take } from 'rxjs';

@Injectable()
export class TemplateRegenerationService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly omdb = inject(OMDbService);
  private readonly api = inject(ApiService);
  private readonly collection = inject(CollectionService);
  private readonly mdContentGenerator = inject(MdContentGeneratorService);
  private readonly _state = signal<TemplateRefreshStateModel>({
    running: false,
    count: 0,
    checked: 0,
    errors: 0,
  });
  private collectionList!: CollectionModel;
  public readonly state = this._state.asReadonly();

  public start(collectionList: CollectionModel): void {
    this._state.set({
      running: true,
      count: collectionList.length,
      checked: 0,
      errors: 0,
    });
    this.collectionList = collectionList;
    this.processNext(0);
  }

  private processNext(index: number): void {
    this.blockerLoadingState.patchState(
      'message',
      this.ngxSignalTranslate.translate('Message.RegeneratingTemplates', {
        count: `${this._state().count - this._state().checked}`,
      })
    );

    if (index >= this.collectionList.length) {
      this._state.update((state) => ({ ...state, running: false }));
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
            this.processNext(this.collectionList.length);
            return '';
          } else if (mdContent === this.collectionList[index].rawContent) {
            this._state.update((state) => ({ ...state, checked: state.checked + 1 }));
            this.processNext(index + 1);
            return '';
          }

          return mdContent;
        }),
        filter((mdContent) => mdContent.length > 0),
        mergeMap((mdContent) => this.api.update(this.collectionList[index].name, mdContent)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this._state.update((state) => ({ ...state, checked: state.checked + 1 }));
        this.processNext(index + 1);
      });
  }
}
