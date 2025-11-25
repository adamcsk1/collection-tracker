import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ct-collection-list-item-skeleton',
  template: `
    <div class="skeleton">
      <div class="skeleton-thumb shine"></div>
      <div class="skeleton-body">
        <span class="skeleton-line shine"></span>
        <span class="skeleton-line shine"></span>
        <span class="skeleton-line shine"></span>
      </div>
    </div>
  `,
  styleUrl: './collection-list-item-skeleton.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionListItemSkeleton {}
