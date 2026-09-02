import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LinkButton } from '@components/link-button/link-button';
import { CollectionItemModel } from '../../collection-model';
import { ItemDialogTranslations } from '../item-form/item-form-model';

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
  public readonly tracking = input.required<boolean>();
  public readonly book = input.required<boolean>();
  public readonly album = input(false);
  public readonly isbn = input.required<string>();
  public readonly mbid = input('');
  public readonly episodeProgressText = input.required<string>();
  public readonly showProgress = input(false);
  public readonly progressText = input('');
  public readonly posterImageError = output<void>();
  protected readonly contributorHeading = computed(() => {
    if (this.book()) return this.translations().authors();
    if (this.album()) return this.translations().artists();
    return this.translations().actors();
  });
}
