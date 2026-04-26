import { inject, Injectable } from '@angular/core';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { GetAllApiResponseItemModel } from '@shared/models/api-model';
import { getCollectionItem } from '@shared/utils/get-collection-item-util';
import { mainCollectionStateToken } from '../main/main-collection-store';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly api = inject(ApiService);
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly apiState = inject(apiStateToken);

  public loadCollection(): void {
    if (this.apiState.state.loadNetworkStatus() === 'pending') return;

    this.mainCollectionState.setState('collection', []);

    let firstBatch = true;
    this.api.getAll().subscribe((rawCollectionItems) => {
      const collectionItems = rawCollectionItems.map((item) => getCollectionItem(item));
      if (!firstBatch) this.mainCollectionState.patchState('collection', (state) => [...state, ...collectionItems]);
      else this.mainCollectionState.setState('collection', collectionItems);
      firstBatch = false;
    });
  }

  public addCollectionItem(item: GetAllApiResponseItemModel, first = false): void {
    if (first) this.mainCollectionState.patchState('collection', (state) => [getCollectionItem(item), ...state]);
    else this.mainCollectionState.patchState('collection', (state) => [...state, getCollectionItem(item)]);
  }

  public deleteCollectionItem(itemName: string): void {
    this.mainCollectionState.patchState('collection', (state) => state.filter((item) => item.name !== itemName));
  }

  public updateCollectionItem(itemName: string, rawContent: string, hash: string): void {
    this.mainCollectionState.patchState('collection', (state) => {
      const index = state.findIndex((item) => item.name === itemName);
      if (index !== -1) state[index] = getCollectionItem({ name: itemName, content: rawContent, hash });
      return state;
    });
  }
}
