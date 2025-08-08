import { Component, inject, input } from '@angular/core';
import { PortalService } from '../../../../lib/services/portal/portal-service';
import { CollectionItemDialog } from '../../collection-item-dialog/collection-item-dialog';
import { CollectionItemModel } from '../../collection-model';
import { collectionStateToken } from '../../collection-store';

@Component({
  selector: 'ct-collection-list-item',
  templateUrl: './collection-list-item.html',
  styleUrl: './collection-list-item.css',
})
export class CollectionListItem {
  private readonly collectionState = inject(collectionStateToken);
  private readonly portal = inject(PortalService);
  public readonly collectionItem = input.required<CollectionItemModel>();

  protected onSetSearchText(searchValue: string): void {
    this.collectionState.setState('searchText', searchValue);
  }

  protected onOpenDetail(): void {
    this.portal.open(CollectionItemDialog, { collectionItem: this.collectionItem() });
  }
}
