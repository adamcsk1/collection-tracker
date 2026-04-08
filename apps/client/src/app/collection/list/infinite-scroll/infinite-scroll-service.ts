import { computed, Injectable, Signal, signal } from '@angular/core';
import { CollectionItemModel } from '../../collection-model';
import { INFINITE_SCROLL_PAGE_SIZE } from './infinite-scroll-const';

@Injectable()
export class InfiniteScrollService {
  private readonly visibleCount = signal(INFINITE_SCROLL_PAGE_SIZE);
  private collectionSource!: Signal<CollectionItemModel[]>;

  public readonly visibleItems = computed(() => this.collectionSource().slice(0, this.visibleCount()));
  public readonly hasMore = computed(() => this.visibleCount() < this.collectionSource().length);

  public setCollectionSource(collection: Signal<CollectionItemModel[]>): void {
    this.collectionSource = collection;
  }

  public loadMore(): void {
    this.visibleCount.update((count) => Math.min(count + INFINITE_SCROLL_PAGE_SIZE, this.collectionSource().length));
  }

  public reset(): void {
    this.visibleCount.set(INFINITE_SCROLL_PAGE_SIZE);
  }
}
