import { inject, Injectable } from '@angular/core';
import { CollectionItemApiModel, CollectionListTypeModel } from '@shared/models/api-model';
import { mainCollectionStateToken } from '../main/main-collection-store';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly mainCollectionState = inject(mainCollectionStateToken);

  private getCollectionItemKey(
    externalProvider: string,
    externalItemId: string,
    ownerShareCode?: string,
    listType: CollectionListTypeModel = 'library'
  ): string {
    return JSON.stringify([ownerShareCode ?? '', listType, externalProvider, externalItemId]);
  }

  private getItemKey(item: CollectionItemApiModel, listType: CollectionListTypeModel = item.listType): string {
    return this.getCollectionItemKey(item.externalProvider, item.externalItemId, item.ownerShareCode, listType);
  }

  public triggerReload(): void {
    this.mainCollectionState.patchState('reloadTrigger', (trigger) => trigger + 1);
  }

  public addCollectionItem(item: CollectionItemApiModel, first = false): void {
    const itemKey = this.getItemKey(item);
    this.mainCollectionState.patchState('collection', (state) => {
      const index = state.findIndex((stateItem) => this.getItemKey(stateItem) === itemKey);
      if (index !== -1) {
        return state.map((stateItem, stateIndex) => (stateIndex === index ? item : stateItem));
      }

      return first ? [item, ...state] : [...state, item];
    });
  }

  public deleteCollectionItem(
    item: CollectionItemApiModel,
    ownerShareCode?: string,
    listType?: CollectionListTypeModel
  ): void {
    const itemKey = this.getCollectionItemKey(
      item.externalProvider,
      item.externalItemId,
      ownerShareCode ?? item.ownerShareCode,
      listType ?? item.listType
    );
    this.mainCollectionState.patchState('collection', (state) =>
      state.filter((stateItem) => this.getItemKey(stateItem) !== itemKey)
    );
  }

  public updateCollectionItem(
    previousItem: CollectionItemApiModel,
    item: CollectionItemApiModel,
    ownerShareCode?: string,
    listType: CollectionListTypeModel = item.listType
  ): void {
    const itemKey = this.getCollectionItemKey(
      previousItem.externalProvider,
      previousItem.externalItemId,
      ownerShareCode ?? previousItem.ownerShareCode,
      listType
    );
    this.mainCollectionState.patchState('collection', (state) => {
      const index = state.findIndex((stateItem) => this.getItemKey(stateItem) === itemKey);
      return index === -1 ? state : state.map((stateItem, stateIndex) => (stateIndex === index ? item : stateItem));
    });
  }
}
