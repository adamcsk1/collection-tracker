import { inject, Injectable } from '@angular/core';
import { CollectionItemApiModel } from '@shared/models/api-model';
import { mainCollectionStateToken } from '../main/main-collection-store';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly mainCollectionState = inject(mainCollectionStateToken);

  private getCollectionItemKey(imdbId: string, ownerShareCode?: string): string {
    return `${ownerShareCode ?? ''}:${imdbId}`;
  }

  public triggerReload(): void {
    this.mainCollectionState.patchState('reloadTrigger', (trigger) => trigger + 1);
  }

  public addCollectionItem(item: CollectionItemApiModel, first = false): void {
    if (first) this.mainCollectionState.patchState('collection', (state) => [item, ...state]);
    else this.mainCollectionState.patchState('collection', (state) => [...state, item]);
  }

  public deleteCollectionItem(imdbId: string, ownerShareCode?: string): void {
    const itemKey = this.getCollectionItemKey(imdbId, ownerShareCode);
    this.mainCollectionState.patchState('collection', (state) =>
      state.filter((item) => this.getCollectionItemKey(item.IMDbId, item.ownerShareCode) !== itemKey)
    );
  }

  public updateCollectionItem(imdbId: string, item: CollectionItemApiModel, ownerShareCode?: string): void {
    const itemKey = this.getCollectionItemKey(imdbId, ownerShareCode);
    this.mainCollectionState.patchState('collection', (state) => {
      const index = state.findIndex((item) => this.getCollectionItemKey(item.IMDbId, item.ownerShareCode) === itemKey);
      if (index !== -1) state[index] = item;
      return state;
    });
  }
}
