import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { memosStateToken } from '@lib/services/memos/memos-store';
import { randomInt } from '@lib/utils/random-int-util';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

import { PortalService } from '../../../lib/services/portal-service';
import { appCollectionStateToken } from '../../app-collection-store';
import { appStateToken } from '../../app-store';
import { CollectionItemDialog } from '../collection-item-dialog/collection-item-dialog';
import { CollectionNewItemDialog } from '../collection-new-item-dialog/collection-new-item-dialog';
import { collectionStateToken } from '../collection-store';
import { CollectionListItemSkeleton } from './collection-list-item-skeleton/collection-list-item-skeleton';
import { CollectionListItem } from './collection-list-item/collection-list-item';

@Component({
  selector: 'ct-collection-list',
  imports: [NgxSignalTranslatePipe, CollectionListItem, CollectionListItemSkeleton],
  templateUrl: './collection-list.html',
  styleUrl: './collection-list.css',
})
export class CollectionList {
  private readonly appCollectionState = inject(appCollectionStateToken);
  private readonly appState = inject(appStateToken);
  private readonly memosState = inject(memosStateToken);
  private readonly collectionState = inject(collectionStateToken);
  private readonly portal = inject(PortalService);
  protected readonly filteredCollection = computed(() => {
    const searchText = this.collectionState.state.searchText().toLowerCase();
    this.resetScrollPosition();
    return this.appCollectionState.state
      .collection()
      .filter((collectionItem) => collectionItem.rawContent.toLowerCase().includes(searchText));
  });
  private readonly limit = 50;
  private readonly lastPageItem = computed(() => this.offset() + this.limit);
  protected readonly paginatedCollection = computed(() => {
    const filteredCollection = this.filteredCollection();
    return filteredCollection.slice(this.offset(), this.lastPageItem());
  });
  protected readonly disablePreviousButton = computed(() => this.offset() === 0);
  protected readonly disableNextButton = computed(() => this.filteredCollection().length - 1 <= this.lastPageItem());
  protected readonly offset = signal(0);
  protected readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  protected readonly memosLoadNetworkStatus = this.memosState.state.loadNetworkStatus;
  protected readonly collectionLength = computed(() => this.appCollectionState.state.collection().length);
  protected readonly permissionAdd = computed(() => this.appState.state.permissions().create);

  constructor() {
    effect(() => {
      this.collectionState.state.searchText();
      this.resetScrollPosition();
    });
  }

  protected onRandomPick(): void {
    const filteredCollection = this.filteredCollection();
    const randomIndex = randomInt(0, filteredCollection.length - 1);

    this.portal.open(CollectionItemDialog, { collectionItem: filteredCollection[randomIndex] });
  }

  protected onAddNew(): void {
    this.portal.open(CollectionNewItemDialog);
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
