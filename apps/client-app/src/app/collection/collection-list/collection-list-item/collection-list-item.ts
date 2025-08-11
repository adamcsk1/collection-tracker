import { Component, inject, input } from '@angular/core';
import { CollectionItemDialog } from '@client-app/collection/collection-item-dialog/collection-item-dialog';
import { CollectionItemModel } from '@client-app/collection/collection-model';
import { collectionStateToken } from '@client-app/collection/collection-store';
import { PortalService } from '@services/portal-service';

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
