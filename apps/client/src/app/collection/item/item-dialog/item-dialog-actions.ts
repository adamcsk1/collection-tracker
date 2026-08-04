import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RevealLabel } from '@components/reveal-label/reveal-label';
import { ItemDialogTranslations } from '../item-form/item-form-model';

@Component({
  selector: 'ct-item-dialog-actions',
  imports: [RevealLabel],
  templateUrl: './item-dialog-actions.html',
  styleUrl: './item-dialog-actions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDialogActions {
  public readonly translations = input.required<ItemDialogTranslations>();
  public readonly editMode = input.required<boolean>();
  public readonly permissionUpdate = input.required<boolean>();
  public readonly permissionWatch = input.required<boolean>();
  public readonly permissionDelete = input.required<boolean>();
  public readonly watching = input.required<boolean>();
  public readonly libraryItem = input.required<boolean>();
  public readonly watchlist = input.required<boolean>();
  public readonly movie = input.required<boolean>();
  public readonly series = input.required<boolean>();
  public readonly watched = input.required<boolean>();
  public readonly favorite = input.required<boolean>();
  public readonly inWatching = input.required<boolean>();
  public readonly inWatched = input.required<boolean>();
  public readonly watchedEnabled = input.required<boolean>();
  public readonly watchingEnabled = input.required<boolean>();

  public readonly manageWatchedEpisodes = output<void>();
  public readonly manageSeriesMetadata = output<void>();
  public readonly markAsUnwatched = output<void>();
  public readonly markAsWatched = output<void>();
  public readonly copyToWatching = output<void>();
  public readonly removeFromWatching = output<void>();
  public readonly moveToWatched = output<void>();
  public readonly moveToWatching = output<void>();
  public readonly openInWatching = output<void>();
  public readonly removeFavorite = output<void>();
  public readonly markAsFavorite = output<void>();
  public readonly edit = output<void>();
  public readonly delete = output<void>();
}
