import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ItemDialogTranslations } from './item-dialog-types';

@Component({
  selector: 'ct-item-dialog-actions',
  templateUrl: './item-dialog-actions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDialogActions {
  public readonly translations = input.required<ItemDialogTranslations>();
  public readonly editMode = input.required<boolean>();
  public readonly permissionUpdate = input.required<boolean>();
  public readonly permissionDelete = input.required<boolean>();
  public readonly seriesTracker = input.required<boolean>();
  public readonly libraryItem = input.required<boolean>();
  public readonly watched = input.required<boolean>();
  public readonly favorite = input.required<boolean>();
  public readonly internalCollectionTag = input.required<string | null>();

  public readonly manageWatchedEpisodes = output<void>();
  public readonly manageSeriesMetadata = output<void>();
  public readonly markAsUnwatched = output<void>();
  public readonly markAsWatched = output<void>();
  public readonly removeFavorite = output<void>();
  public readonly markAsFavorite = output<void>();
  public readonly edit = output<void>();
  public readonly delete = output<void>();
}
