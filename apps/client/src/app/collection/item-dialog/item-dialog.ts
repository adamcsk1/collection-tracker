import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, model, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, validate } from '@angular/forms/signals';
import { CollectionItemModel } from '@client/collection/collection-model';
import { CollectionService } from '@client/collection/collection-service';
import { internalTagValidation } from '@client/collection/item-dialog/validators/internal-tag-validator';
import { rawContentValidation } from '@client/collection/item-dialog/validators/raw-content-validator';
import { virtualTagValidation } from '@client/collection/item-dialog/validators/virtual-tag-validator';
import { getCollectionItem } from '@client/collection/utils/get-collection-item-util';
import { mainStateToken } from '@client/main/main-store';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { MarkdownEditor } from '@components/markdown-editor/markdown-editor';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { addNewTagToRawContent, removeTagFromRawContent } from '@services/parser/utils/manage-tags-util';
import { PortalService } from '@services/portal-service';
import { WATCHED_TAG } from '@shared/constants/tags-const';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { map, mergeMap, of } from 'rxjs';

@Component({
  selector: 'ct-item-dialog',
  imports: [NgxSignalTranslatePipe, MarkdownEditor, DialogShell, FormField],
  templateUrl: './item-dialog.html',
  styleUrl: './item-dialog.css',
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDialog implements OnInit {
  private readonly collectionService = inject(CollectionService);
  private readonly portal = inject(PortalService);
  private readonly mainState = inject(mainStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lastSavedRawContent = signal('');
  protected readonly rawContentModel = signal('');
  protected readonly rawContentField = form(this.rawContentModel, (content) => {
    validate(content, ({ value }) => virtualTagValidation(value()));
    validate(content, ({ value }) => internalTagValidation(value()));
  });
  protected readonly formErrors = {
    rawContent: {
      usedVirtualTag: computed(() =>
        this.rawContentField()
          .errors()
          .some((error) => error.kind === 'usedVirtualTag')
      ),
      unusedInternalTag: computed(() =>
        this.rawContentField()
          .errors()
          .some((error) => error.kind === 'unusedInternalTag')
      ),
    },
  };
  protected readonly editMode = signal(false);
  protected readonly permissionUpdate = computed(() => this.mainState.state.permissions().update);
  protected readonly permissionDelete = computed(() => this.mainState.state.permissions().delete);
  protected readonly watched = computed(() => this.collectionItem().tags.includes(WATCHED_TAG));
  public readonly collectionItem = model.required<CollectionItemModel>();

  public ngOnInit(): void {
    this.rawContentModel.set(this.collectionItem().rawContent);
    this.lastSavedRawContent.set(this.collectionItem().rawContent);
  }

  protected onDelete(): void {
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.Delete', { name: this.collectionItem().title }))
      .pipe(
        mergeMap((confirmed) => {
          if (confirmed) return this.api.delete(this.collectionItem().name).pipe(map(() => confirmed));
          else return of(confirmed);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.DeleteItem'));
          this.collectionService.deleteCollectionItem(this.collectionItem().name);
          this.portal.close();
        }
      });
  }

  protected onEdit(): void {
    this.editMode.set(true);
  }

  protected onReadOnly(): void {
    if (this.rawContentModel() !== this.lastSavedRawContent()) this.rawContentModel.set(this.lastSavedRawContent());

    this.editMode.set(false);
  }

  protected onSaveChanges(): void {
    if (this.rawContentField().invalid()) {
      if (this.formErrors.rawContent.usedVirtualTag()) {
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.UsedVirtualTagInContent'));
      }
      if (this.formErrors.rawContent.unusedInternalTag()) {
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.UnusedInternalTagInContent'));
      }
      return;
    }

    if (rawContentValidation(this.rawContentModel())) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.BadRawContent'));
      return;
    }

    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.Change', { name: this.collectionItem().title }))
      .pipe(
        mergeMap((confirmed) => {
          if (confirmed) {
            return this.api.update(this.collectionItem().name, this.rawContentModel()).pipe(map(() => confirmed));
          } else return of(confirmed);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
          this.collectionService.updateCollectionItem(this.collectionItem().name, this.rawContentModel());
          this.collectionItem.update((collectionItem) =>
            getCollectionItem({ name: collectionItem.name, content: this.rawContentModel() })
          );
          this.lastSavedRawContent.set(this.collectionItem().rawContent);
          this.onReadOnly();
        }
      });
  }

  protected onMarkAsWatched(): void {
    const updatedRawContent = addNewTagToRawContent(this.rawContentModel(), WATCHED_TAG);
    if (!updatedRawContent) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SetWatchedError'));
      return;
    }

    this.rawContentModel.set(updatedRawContent);
    this.onSaveChanges();
  }

  protected onMarkAsUnwatched(): void {
    const updatedRawContent = removeTagFromRawContent(this.rawContentModel(), WATCHED_TAG);
    this.rawContentModel.set(updatedRawContent);
    this.onSaveChanges();
  }
}
