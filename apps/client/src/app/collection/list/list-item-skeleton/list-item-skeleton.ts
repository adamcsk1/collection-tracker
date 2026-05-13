import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ct-list-item-skeleton',
  template: `
    <div class="card skeleton">
      <div class="skeleton-thumb shine"></div>
      <div class="skeleton-body">
        <span class="skeleton-line shine"></span>
        <span class="skeleton-line shine"></span>
      </div>
    </div>
  `,
  styleUrl: './list-item-skeleton.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
    'aria-hidden': 'true',
  },
})
export class ListItemSkeleton {}
