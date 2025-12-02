import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ItemDialog } from '@client/collection/item-dialog/item-dialog';
import { ListItemSkeleton } from '@client/collection/list/list-item-skeleton/list-item-skeleton';
import { ListItem } from '@client/collection/list/list-item/list-item';
import { NewItemDialog } from '@client/collection/new-item-dialog/new-item-dialog';
import { collectionStateToken } from '@client/collection/collection-store';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { mainStateToken } from '@client/main/main-store';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { randomInt } from '@shared/utils/random-int-util';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-list',
  imports: [NgxSignalTranslatePipe, ListItem, ListItemSkeleton],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class List {
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly mainState = inject(mainStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly collectionState = inject(collectionStateToken);
  private readonly portal = inject(PortalService);
  protected readonly filteredCollection = computed(() => {
    const searchText = this.collectionState.state.searchText().toLowerCase();
    this.resetScrollPosition();
    return this.mainCollectionState.state
      .collection()
      .filter((collectionItem) => collectionItem.rawContent.toLowerCase().includes(searchText));
  });
  private readonly limit = 150;
  private readonly lastPageItem = computed(() => this.offset() + this.limit);
  protected readonly paginatedCollection = computed(() => {
    const filteredCollection = this.filteredCollection();
    return filteredCollection.slice(this.offset(), this.lastPageItem());
  });
  protected readonly disablePreviousButton = computed(() => this.offset() === 0);
  protected readonly disableNextButton = computed(() => this.filteredCollection().length - 1 <= this.lastPageItem());
  protected readonly offset = signal(0);
  protected readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly collectionLength = computed(() => this.mainCollectionState.state.collection().length);
  protected readonly permissionAdd = computed(() => this.mainState.state.permissions().create);

  constructor() {
    effect(() => {
      this.collectionState.state.searchText();
      this.resetScrollPosition();
    });
  }

  protected onRandomPick(): void {
    const filteredCollection = this.filteredCollection();
    const randomIndex = randomInt(0, filteredCollection.length - 1);

    this.portal.open(ItemDialog, { collectionItem: filteredCollection[randomIndex] });
  }

  protected onAddNew(): void {
    this.portal.open(NewItemDialog);
  }

  protected onFirstPage(): void {
    this.offset.set(0);
    this.resetScrollPosition();
  }

  protected onPreviousPage(): void {
    this.offset.update((state) => (state -= this.limit));
    if (this.offset() < 0) this.offset.set(0);
    this.resetScrollPosition();
  }

  protected onNextPage(): void {
    const filteredCollectionLength = this.filteredCollection().length - 1;
    this.offset.update((state) => (state += this.limit));
    if (this.lastPageItem() >= filteredCollectionLength) this.offset.set(filteredCollectionLength);
    this.resetScrollPosition();
  }

  protected onLastPage(): void {
    const filteredCollectionLength = this.filteredCollection().length - 1;
    this.offset.set(filteredCollectionLength);
    this.resetScrollPosition();
  }

  private resetScrollPosition(): void {
    this.scrollContainer()!.nativeElement.scrollTo({
      top: 0,
      left: 1000,
      behavior: 'smooth',
    });
  }
}
