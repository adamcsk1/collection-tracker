import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CollectionItemModel } from '@client/collection/collection-model';
import { collectionStateToken } from '@client/collection/collection-store';
import { ItemDialog } from '@client/collection/item-dialog/item-dialog';
import { PortalService } from '@services/portal-service';

@Component({
  selector: 'ct-list-item',
  templateUrl: './list-item.html',
  styleUrl: './list-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
  },
})
export class ListItem {
  private readonly collectionState = inject(collectionStateToken);
  private readonly portal = inject(PortalService);
  public readonly collectionItem = input.required<CollectionItemModel>();

  protected onSetSearchText(searchValue: string | number | null): void {
    if (searchValue !== null) this.collectionState.setState('searchText', `${searchValue}`);
  }

  protected onOpenDetail(): void {
    this.portal.open(ItemDialog, { collectionItem: this.collectionItem() });
  }
}
