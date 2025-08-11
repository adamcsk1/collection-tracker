import { Component, computed, DestroyRef, inject, model, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { appStateToken } from '@client-app/app-store';
import { CollectionItemModel } from '@client-app/collection/collection-model';
import { CollectionService } from '@client-app/collection/collection-service';
import { getCollectionItem } from '@client-app/collection/utils/get-collection-item-util';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Textarea } from '@components/textarea/textarea';
import { toastStateToken } from '@components/toast/toast-store';
import { ConfirmService } from '@services/confirm-service';
import { MemosService } from '@services/memos/memos-service';
import { PortalService } from '@services/portal-service';
import { marked } from 'marked';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { mergeMap, of } from 'rxjs';

@Component({
  selector: 'ct-collection-item-dialog',
  imports: [NgxSignalTranslatePipe, Textarea, DialogShell],
  templateUrl: './collection-item-dialog.html',
  styleUrl: './collection-item-dialog.css',
  host: {
    class: 'dialog',
  },
})
export class CollectionItemDialog implements OnInit {
  private readonly collectionService = inject(CollectionService);
  private readonly portal = inject(PortalService);
  private readonly appState = inject(appStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly memos = inject(MemosService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly _editMode = signal(false);
  protected parsedMdContent = computed(() => {
    const rawContent = this.collectionItem().rawContent;
    return marked.parse(rawContent, { breaks: true });
  });
  protected readonly rawContentControl = new FormControl<string>('', { nonNullable: true });
  protected readonly editMode = this._editMode.asReadonly();
  protected readonly permissionUpdate = computed(() => this.appState.state.permissions().update);
  protected readonly permissionDelete = computed(() => this.appState.state.permissions().delete);
  public readonly collectionItem = model.required<CollectionItemModel>();

  public ngOnInit(): void {
    this.rawContentControl.setValue(this.collectionItem().rawContent);
  }

  protected onDelete(): void {
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.DeleteMemo', { name: this.collectionItem().title }))
      .pipe(
        mergeMap((confirmed) => {
          if (confirmed) return this.memos.deleteMemo(this.collectionItem().memoName);
          else return of(confirmed);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.DeleteItem'));
          this.collectionService.deleteCollectionItem(this.collectionItem().memoName);
          this.portal.close();
        }
      });
  }

  protected onEdit(): void {
    this._editMode.set(true);
  }

  protected onReadOnly(): void {
    this._editMode.set(false);
  }

  protected onSaveChanges(): void {
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.ChangeMemo', { name: this.collectionItem().title }))
      .pipe(
        mergeMap((confirmed) => {
          if (confirmed) return this.memos.updateMemo(this.collectionItem().memoName, this.rawContentControl.value);
          else return of(confirmed);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
          this.collectionService.updateCollectionItem(this.collectionItem().memoName, this.rawContentControl.value);
          this.collectionItem.update((collectionItem) =>
            getCollectionItem({ name: collectionItem.memoName, content: this.rawContentControl.value })
          );
          this.onReadOnly();
        }
      });
  }
}
