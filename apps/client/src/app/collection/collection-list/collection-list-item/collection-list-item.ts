import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CollectionItemDialog } from '@client/collection/collection-item-dialog/collection-item-dialog';
import { CollectionItemModel } from '@client/collection/collection-model';
import { collectionStateToken } from '@client/collection/collection-store';
import { PortalService } from '@services/portal-service';

@Component({
  selector: 'ct-collection-list-item',
  templateUrl: './collection-list-item.html',
  styleUrl: './collection-list-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
  },
})
export class CollectionListItem {
  private readonly collectionState = inject(collectionStateToken);
  private readonly portal = inject(PortalService);
  public readonly collectionItem = input.required<CollectionItemModel>();

  protected onSetSearchText(searchValue: string | number | null): void {
    if (searchValue !== null) this.collectionState.setState('searchText', `${searchValue}`);
  }

  protected onOpenDetail(): void {
    this.portal.open(CollectionItemDialog, { collectionItem: this.collectionItem() });
  }
}
