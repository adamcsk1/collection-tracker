import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CollectionItemModel } from '@client/collection/collection-model';
import { collectionStateToken } from '@client/collection/collection-store';
import { ItemDialog } from '@client/collection/item-dialog/item-dialog';
import { PortalService } from '@services/portal-service';
import { MOVIE_TAG, SERIES_TAG, VIRTUAL_UNWATCHED_TAG, WATCHED_TAG } from '@shared/constants/tags-const';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-list-item',
  templateUrl: './list-item.html',
  styleUrl: './list-item.css',
  imports: [NgxSignalTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
  },
})
export class ListItem {
  private readonly collectionState = inject(collectionStateToken);
  private readonly portal = inject(PortalService);
  protected readonly watched = computed(() => this.collectionItem().tags.includes(WATCHED_TAG) ?? false);
  protected readonly movie = computed(() => this.collectionItem().tags.includes(MOVIE_TAG) ?? false);
  protected readonly series = computed(() => this.collectionItem().tags.includes(SERIES_TAG) ?? false);
  protected readonly tags = computed(() =>
    this.collectionItem().tags.filter((tag) => ![WATCHED_TAG, MOVIE_TAG, SERIES_TAG].includes(tag))
  );
  protected readonly WATCHED_TAG = WATCHED_TAG;
  protected readonly MOVIE_TAG = MOVIE_TAG;
  protected readonly SERIES_TAG = SERIES_TAG;
  protected readonly VIRTUAL_UNWATCHED_TAG = VIRTUAL_UNWATCHED_TAG;
  public readonly collectionItem = input.required<CollectionItemModel>();

  protected onSetSearchText(searchValue: string | number | null): void {
    if (searchValue !== null) {
      this.collectionState.setState('forceStandardSearch', true);
      this.collectionState.setState('searchText', `${searchValue}`);
    }
  }

  protected onOpenDetail(): void {
    this.portal.open(ItemDialog, { collectionItem: this.collectionItem() });
  }
}
