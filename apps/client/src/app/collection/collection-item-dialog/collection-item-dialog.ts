import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, model, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { CollectionItemModel } from '@client/collection/collection-model';
import { CollectionService } from '@client/collection/collection-service';
import { getCollectionItem } from '@client/collection/utils/get-collection-item-util';
import { mainStateToken } from '@client/main/main-store';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Textarea } from '@components/textarea/textarea';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { marked } from 'marked';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { map, mergeMap, of } from 'rxjs';

@Component({
  selector: 'ct-collection-item-dialog',
  imports: [NgxSignalTranslatePipe, Textarea, DialogShell],
  templateUrl: './collection-item-dialog.html',
  styleUrl: './collection-item-dialog.css',
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionItemDialog implements OnInit {
  private readonly collectionService = inject(CollectionService);
  private readonly portal = inject(PortalService);
  private readonly mainState = inject(mainStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected parsedMdContent = computed(() => {
    const rawContent = this.collectionItem().rawContent;
    return marked.parse(rawContent, { breaks: true });
  });
  protected readonly rawContentControl = new FormControl<string>('', { nonNullable: true });
  protected readonly editMode = signal(false);
  protected readonly permissionUpdate = computed(() => this.mainState.state.permissions().update);
  protected readonly permissionDelete = computed(() => this.mainState.state.permissions().delete);
  public readonly collectionItem = model.required<CollectionItemModel>();

  public ngOnInit(): void {
    this.rawContentControl.setValue(this.collectionItem().rawContent);
  }

  protected onDelete(): void {
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.Delete', { name: this.collectionItem().title }))
      .pipe(
        mergeMap((confirmed) => {
          if (confirmed) return this.api.delete(this.collectionItem().name).pipe(map(() => confirmed));
          else return of(confirmed);
        }),
        takeUntilDestroyed(this.destroyRef)
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
    this.editMode.set(false);
  }

  protected onSaveChanges(): void {
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.Change', { name: this.collectionItem().title }))
      .pipe(
        mergeMap((confirmed) => {
          if (confirmed) {
            return this.api.update(this.collectionItem().name, this.rawContentControl.value).pipe(map(() => confirmed));
          } else return of(confirmed);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
          this.collectionService.updateCollectionItem(this.collectionItem().name, this.rawContentControl.value);
          this.collectionItem.update((collectionItem) =>
            getCollectionItem({ name: collectionItem.name, content: this.rawContentControl.value })
          );
          this.onReadOnly();
        }
      });
  }
}
