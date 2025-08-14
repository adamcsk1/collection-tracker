import { inject, Injectable } from '@angular/core';
import { appCollectionStateToken } from '@client/app-collection-store';
import { getCollectionItem } from '@client/collection/utils/get-collection-item-util';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { GetAllApiResponseItemModel } from '@shared/models/api-model';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly api = inject(ApiService);
  private readonly appCollectionState = inject(appCollectionStateToken);
  private readonly apiState = inject(apiStateToken);

  public loadCollection(): void {
    if (this.apiState.state.loadNetworkStatus() === 'pending') return;

    this.api
      .getAll()
      .subscribe((collectionItems) =>
        this.appCollectionState.patchState('collection', (state) => [
          ...state,
          ...collectionItems.map((item) => getCollectionItem(item)),
        ])
      );
  }

  public addCollectionItem(item: GetAllApiResponseItemModel, first = false): void {
    if (first) this.appCollectionState.patchState('collection', (state) => [getCollectionItem(item), ...state]);
    else this.appCollectionState.patchState('collection', (state) => [...state, getCollectionItem(item)]);
  }

  public deleteCollectionItem(itemName: string): void {
    this.appCollectionState.patchState('collection', (state) => state.filter((item) => item.name !== itemName));
  }

  public updateCollectionItem(itemName: string, rawContent: string): void {
    this.appCollectionState.patchState('collection', (state) => {
      const index = state.findIndex((item) => item.name === itemName);
      if (index !== -1) state[index] = getCollectionItem({ name: itemName, content: rawContent });
      return state;
    });
  }
}
