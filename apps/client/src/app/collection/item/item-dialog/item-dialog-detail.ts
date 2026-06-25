import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LinkButton } from '@components/link-button/link-button';
import { CollectionItemModel } from '../../collection-model';
import { ItemDialogTranslations } from './item-dialog-types';

@Component({
  selector: 'ct-item-dialog-detail',
  imports: [LinkButton],
  templateUrl: './item-dialog-detail.html',
  styleUrl: './item-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDialogDetail {
  public readonly collectionItem = input.required<CollectionItemModel>();
  public readonly translations = input.required<ItemDialogTranslations>();
  public readonly posterImageFailed = input.required<boolean>();
  public readonly imageUrl = input.required<string>();
  public readonly imdbUrl = input.required<string>();
  public readonly trailerUrl = input.required<string>();
  public readonly webSearchUrl = input.required<string>();
  public readonly isShared = input.required<boolean>();
  public readonly library = input.required<string>();
  public readonly detailTags = input.required<string[]>();
  public readonly seriesTracker = input.required<boolean>();
  public readonly episodeProgressText = input.required<string>();
  public readonly posterImageError = output<void>();
}
