import { Component, inject, input } from '@angular/core';
import { componentCollectionStateToken } from '@pages/collection/collection-store';
import { CollectionItemModel } from '@pages/collection/collection.model';

@Component({
  selector: 'ct-collection-list-item',
  templateUrl: './collection-list-item.html',
  styleUrl: './collection-list-item.css',
})
export class CollectionListItem {
  private readonly componentCollectionState = inject(componentCollectionStateToken);
  public readonly collectionItem = input.required<CollectionItemModel>();

  protected onSetSearchText(searchValue: string): void {
    this.componentCollectionState.setState('searchText', searchValue);
  }

  protected onOpenDetail(): void {
    this.componentCollectionState.setState('openedCollectionItem', this.collectionItem());
  }
}
