import { DestroyRef, inject, Injectable, Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { AlertService } from '@services/alert-service';
import { ConfirmService } from '@services/confirm-service';
import { ParserService as MainParserService } from '@services/parser/parser-service';
import { applyParserConfig } from '@shared/parser/apply-parser-config-util';
import { getParserTemplate } from '@shared/parser/parser-util';
import { generateMdContent } from '@shared/parser/utils/generate-md-content-util';
import { getCollectionItem } from '@shared/utils/get-collection-item-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, delay, tap, throwError } from 'rxjs';
import { CollectionService } from '../collection/collection-service';
import { mainCollectionStateToken } from '../main/main-collection-store';
import { ParserModel, TemplateRefreshStateModel } from './parser-model';
import { PARSER_PREVIEW_OMDB_RESPONSE } from './parser-preview-const';
import { TemplateRegenerationService } from './template-regeneration-service';

@Injectable()
export class ParserService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly mainParserService = inject(MainParserService);
  private readonly collection = inject(CollectionService);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly toastState = inject(toastStateToken);
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  private readonly templateRegeneration = inject(TemplateRegenerationService);
  public readonly state: Signal<TemplateRefreshStateModel> = this.templateRegeneration.state;

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
    const originalParserCache = structuredClone(window.__parserCache);
    try {
      this.setParserCache(formData);
      const mdContentPreview = generateMdContent(getParserTemplate(), PARSER_PREVIEW_OMDB_RESPONSE);

      const parsedCollectionItem = getCollectionItem({ content: mdContentPreview, name: '' });

      window.__parserCache = originalParserCache;
      this.alert.show(
        `${this.ngxSignalTranslate.translate('TemplatePreview')}\n\n ${mdContentPreview}\n\n${this.ngxSignalTranslate.translate(
          'ParsedAttributes'
        )}\n\n${JSON.stringify({ ...parsedCollectionItem, rawContent: undefined, name: undefined }, null, 2)}`
      );
    } catch {
      window.__parserCache = originalParserCache;
      this.alert.show(this.ngxSignalTranslate.translate('Message.PreviewGenerationError'));
    }
  }

  public regenerateTemplates(): void {
    this.confirm.ifConfirmed(this.ngxSignalTranslate.translate('Confirm.TemplateRegeneration')).subscribe(() => {
      this.blockerLoadingState.patchState('withoutDelay', true);
      this.blockerLoadingState.patchState('show', true);
      this.templateRegeneration.start(this.mainCollectionState.state.collection().toReversed());
    });
  }

  private setParserCache(formData: ParserModel): void {
    applyParserConfig(formData);
  }
}
