import { computed, Injectable, Signal, signal } from '@angular/core';
import { CollectionItemModel } from '@client/collection/collection-model';
import { PAGINATION_PAGE_SIZE } from '@client/collection/list/pagination/pagination-const';

@Injectable()
export class PaginationService {
  private readonly _offset = signal(0);
  private readonly lastItem = computed(() => this._offset() + PAGINATION_PAGE_SIZE);
  private collectionSource!: Signal<CollectionItemModel[]>;

  public readonly offset = this._offset.asReadonly();
  public readonly paginatedItems = computed(() => this.collectionSource().slice(this._offset(), this.lastItem()));
  public readonly disablePrevious = computed(() => this._offset() === 0);
  public readonly disableNext = computed(() => this.collectionSource().length - 1 < this.lastItem());

  public setCollectionSource(collection: Signal<CollectionItemModel[]>): void {
    this.collectionSource = collection;
  }

  public firstPage(): void {
    this._offset.set(0);
  }

  public previousPage(): void {
    this._offset.update((offset) => offset - PAGINATION_PAGE_SIZE);
    if (this._offset() < 0) this._offset.set(0);
  }

  public nextPage(): void {
    const lastIndex = this.collectionSource().length - 1;
    this._offset.update((offset) => offset + PAGINATION_PAGE_SIZE);
    if (this.lastItem() >= lastIndex) this._offset.set(lastIndex);
  }

  public lastPage(): void {
    this._offset.set(this.collectionSource().length - 1);
  }
}
