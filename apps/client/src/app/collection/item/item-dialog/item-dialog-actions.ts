import { ChangeDetectionStrategy, Component, computed, inject, input, output, OutputEmitterRef } from '@angular/core';
import { ActionMenu } from '@components/action-menu/action-menu';
import { ActionMenuActionModel } from '@components/action-menu/action-menu-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { ItemDialogTranslations } from '../item-form/item-form-model';

@Component({
  selector: 'ct-item-dialog-actions',
  imports: [ActionMenu],
  templateUrl: './item-dialog-actions.html',
  styleUrl: './item-dialog-actions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDialogActions {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly actionTranslations = {
    finish: computed(() => this.ngxSignalTranslate.translate('ItemAction.Finish')),
    finished: computed(() => this.ngxSignalTranslate.translate('ItemAction.Finished')),
    favorite: computed(() => this.ngxSignalTranslate.translate('ItemAction.Favorite')),
    episodes: computed(() => this.ngxSignalTranslate.translate('ItemAction.Episodes')),
    title: computed(() => this.ngxSignalTranslate.translate('ItemAction.Title')),
  };
  protected readonly secondaryActions = computed<ActionMenuActionModel[]>(() => {
    const translations = this.translations();
    const actions: ActionMenuActionModel[] = [];
    if (this.permissionUpdate()) actions.push({ id: 'item-dialog-edit', label: translations.edit(), icon: 'edit' });
    if (this.ownItem()) actions.push({ id: 'item-dialog-share', label: translations.share(), icon: 'share' });
    if (
      this.trackingEnabled() &&
      this.permissionWatch() &&
      this.ownershipItem() &&
      (this.series() || this.book() || this.album())
    ) {
      if (this.inTracking()) {
        actions.push(
          { id: 'item-dialog-open-in-tracking', label: translations.openInTracking(), icon: 'open_in_new' },
          { id: 'item-dialog-remove-tracking', label: translations.removeFromTracking(), icon: 'format_list_numbered' }
        );
      } else {
        actions.push({ id: 'item-dialog-copy-tracking', label: translations.copyToTracking(), icon: 'playlist_add' });
      }
    }
    if (
      this.trackingEnabled() &&
      this.upNext() &&
      (this.series() || this.book() || this.album()) &&
      !this.inTracking()
    ) {
      actions.push({ id: 'item-dialog-move-tracking', label: translations.moveToTracking(), icon: 'playlist_add' });
    }
    if (this.permissionUpdate() && this.tracking() && this.series()) {
      actions.push({
        id: 'item-dialog-manage-series-metadata',
        label: translations.manageSeriesMetadata(),
        icon: 'list',
      });
    }
    if (this.permissionDelete())
      actions.push({ id: 'item-dialog-delete', label: translations.delete(), icon: 'delete', destructive: true });
    return actions;
  });
  public readonly translations = input.required<ItemDialogTranslations>();
  public readonly editMode = input.required<boolean>();
  public readonly permissionUpdate = input.required<boolean>();
  public readonly permissionWatch = input.required<boolean>();
  public readonly permissionDelete = input.required<boolean>();
  public readonly tracking = input.required<boolean>();
  public readonly libraryItem = input.required<boolean>();
  public readonly ownershipItem = input.required<boolean>();
  public readonly upNext = input.required<boolean>();
  public readonly movie = input.required<boolean>();
  public readonly series = input.required<boolean>();
  public readonly book = input(false);
  public readonly album = input(false);
  public readonly finished = input.required<boolean>();
  public readonly favorite = input.required<boolean>();
  public readonly inTracking = input.required<boolean>();
  public readonly inFinished = input.required<boolean>();
  public readonly finishedEnabled = input.required<boolean>();
  public readonly trackingEnabled = input.required<boolean>();
  public readonly ownItem = input.required<boolean>();

  public readonly manageCompletedEpisodes = output<void>();
  public readonly manageSeriesMetadata = output<void>();
  public readonly markAsUnfinished = output<void>();
  public readonly markAsFinished = output<void>();
  public readonly copyToTracking = output<void>();
  public readonly removeFromTracking = output<void>();
  public readonly moveToFinished = output<void>();
  public readonly moveToTracking = output<void>();
  public readonly openInTracking = output<void>();
  public readonly removeFavorite = output<void>();
  public readonly markAsFavorite = output<void>();
  public readonly edit = output<void>();
  public readonly share = output<void>();
  public readonly delete = output<void>();

  protected onSecondaryAction(action: string): void {
    const outputs: Record<string, OutputEmitterRef<void>> = {
      'item-dialog-edit': this.edit,
      'item-dialog-share': this.share,
      'item-dialog-open-in-tracking': this.openInTracking,
      'item-dialog-remove-tracking': this.removeFromTracking,
      'item-dialog-copy-tracking': this.copyToTracking,
      'item-dialog-move-tracking': this.moveToTracking,
      'item-dialog-manage-series-metadata': this.manageSeriesMetadata,
      'item-dialog-delete': this.delete,
    };
    outputs[action]?.emit();
  }
}
