import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ItemDialogTranslations } from './item-dialog-model';

@Component({
  selector: 'ct-item-dialog-actions',
  templateUrl: './item-dialog-actions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDialogActions {
  public readonly translations = input.required<ItemDialogTranslations>();
  public readonly editMode = input.required<boolean>();
  public readonly permissionUpdate = input.required<boolean>();
  public readonly permissionWatch = input.required<boolean>();
  public readonly permissionDelete = input.required<boolean>();
  public readonly seriesTracker = input.required<boolean>();
  public readonly libraryItem = input.required<boolean>();
  public readonly watchLater = input.required<boolean>();
  public readonly movie = input.required<boolean>();
  public readonly series = input.required<boolean>();
  public readonly watched = input.required<boolean>();
  public readonly favorite = input.required<boolean>();
  public readonly inSeriesTracker = input.required<boolean>();
  public readonly inMovieTracker = input.required<boolean>();

  public readonly manageWatchedEpisodes = output<void>();
  public readonly manageSeriesMetadata = output<void>();
  public readonly markAsUnwatched = output<void>();
  public readonly markAsWatched = output<void>();
  public readonly copyToSeriesTracker = output<void>();
  public readonly removeFromSeriesTracker = output<void>();
  public readonly moveToMovieTracker = output<void>();
  public readonly moveToSeriesTracker = output<void>();
  public readonly removeFavorite = output<void>();
  public readonly markAsFavorite = output<void>();
  public readonly edit = output<void>();
  public readonly delete = output<void>();
}
