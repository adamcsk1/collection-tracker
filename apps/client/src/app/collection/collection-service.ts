import { inject, Injectable } from '@angular/core';
import { CollectionItemApiModel } from '@shared/models/api-model';
import { mainCollectionStateToken } from '../main/main-collection-store';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly mainCollectionState = inject(mainCollectionStateToken);

  public triggerReload(): void {
    this.mainCollectionState.patchState('reloadTrigger', (trigger) => trigger + 1);
  }

  public addCollectionItem(item: CollectionItemApiModel, first = false): void {
    if (first) this.mainCollectionState.patchState('collection', (state) => [item, ...state]);
    else this.mainCollectionState.patchState('collection', (state) => [...state, item]);
  }

  public deleteCollectionItem(imdbId: string): void {
    this.mainCollectionState.patchState('collection', (state) => state.filter((item) => item.IMDbId !== imdbId));
  }

  public updateCollectionItem(imdbId: string, item: CollectionItemApiModel): void {
    this.mainCollectionState.patchState('collection', (state) => {
      const index = state.findIndex((item) => item.IMDbId === imdbId);
      if (index !== -1) state[index] = item;
      return state;
    });
  }
}
