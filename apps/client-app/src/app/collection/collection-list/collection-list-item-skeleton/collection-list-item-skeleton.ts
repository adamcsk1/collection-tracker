import { Component } from '@angular/core';

@Component({
  selector: 'ct-collection-list-item-skeleton',
  template: `
    <div class="collection-list-item-skeleton">
      <div class="collection-list-item-skeleton-image shine"></div>
      <div class="collection-list-item-skeleton-content">
        <span class="collection-list-item-skeleton-content-item shine"></span>
        <span class="collection-list-item-skeleton-content-item shine"></span>
        <span class="collection-list-item-skeleton-content-item shine"></span>
      </div>
    </div>
  `,
  styleUrl: './collection-list-item-skeleton.css',
})
export class CollectionListItemSkeleton {}
