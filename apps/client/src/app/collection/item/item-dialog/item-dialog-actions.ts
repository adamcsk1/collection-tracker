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
  public readonly tracking = input.required<boolean>();
  public readonly libraryItem = input.required<boolean>();
  public readonly ownershipItem = input.required<boolean>();
  public readonly upNext = input.required<boolean>();
  public readonly movie = input.required<boolean>();
  public readonly series = input.required<boolean>();
  public readonly book = input(false);
  public readonly finished = input.required<boolean>();
  public readonly favorite = input.required<boolean>();
  public readonly inTracking = input.required<boolean>();
  public readonly inFinished = input.required<boolean>();
  public readonly finishedEnabled = input.required<boolean>();
  public readonly trackingEnabled = input.required<boolean>();

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
  public readonly delete = output<void>();
}
