import { inject, Injectable } from '@angular/core';
import { CollectionItemApiModel, CollectionListTypeModel } from '@shared/models/api-model';
import { mainCollectionStateToken } from '../main/main-collection-store';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly mainCollectionState = inject(mainCollectionStateToken);

  private getCollectionItemKey(
    imdbId: string,
    ownerShareCode?: string,
    listType: CollectionListTypeModel = 'library'
  ): string {
    return `${ownerShareCode ?? ''}:${listType}:${imdbId}`;
  }

  public triggerReload(): void {
    this.mainCollectionState.patchState('reloadTrigger', (trigger) => trigger + 1);
  }

  public addCollectionItem(item: CollectionItemApiModel, first = false): void {
    const itemKey = this.getCollectionItemKey(item.IMDbId, item.ownerShareCode, item.listType);
    this.mainCollectionState.patchState('collection', (state) => {
      const index = state.findIndex(
        (stateItem) =>
          this.getCollectionItemKey(stateItem.IMDbId, stateItem.ownerShareCode, stateItem.listType) === itemKey
      );
      if (index !== -1) {
        return state.map((stateItem, stateIndex) => (stateIndex === index ? item : stateItem));
      }

      return first ? [item, ...state] : [...state, item];
    });
  }

  public deleteCollectionItem(imdbId: string, ownerShareCode?: string, listType?: CollectionListTypeModel): void {
    const itemKey = this.getCollectionItemKey(imdbId, ownerShareCode, listType);
    this.mainCollectionState.patchState('collection', (state) =>
      state.filter((item) => this.getCollectionItemKey(item.IMDbId, item.ownerShareCode, item.listType) !== itemKey)
    );
  }

  public updateCollectionItem(
    imdbId: string,
    item: CollectionItemApiModel,
    ownerShareCode?: string,
    listType: CollectionListTypeModel = item.listType
  ): void {
    const itemKey = this.getCollectionItemKey(imdbId, ownerShareCode, listType);
    this.mainCollectionState.patchState('collection', (state) => {
      const index = state.findIndex(
        (stateItem) =>
          this.getCollectionItemKey(stateItem.IMDbId, stateItem.ownerShareCode, stateItem.listType) === itemKey
      );
      return index === -1 ? state : state.map((stateItem, stateIndex) => (stateIndex === index ? item : stateItem));
    });
  }
}
