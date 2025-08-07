import { inject, Injectable } from '@angular/core';
import { MemoModel } from '@lib/services/memos/memos-model';
import { MemosService } from '@lib/services/memos/memos-service';
import { memosStateToken } from '@lib/services/memos/memos-store';
import { collectionStateToken } from '@stores/collection-store';
import { getCollectionItem } from './utils/get-collection-item-util';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly memos = inject(MemosService);
  private readonly collectionState = inject(collectionStateToken);
  private readonly memosState = inject(memosStateToken);

  public loadCollection(): void {
    if (this.memosState.state.loadNetworkStatus() === 'pending') return;
    console.log('loadCollection');
    this.memos.getMemos().subscribe((memos) =>
      this.collectionState.patchState('collection', (state) => [
        ...state,
        ...memos
          .filter((memo) => !state.map((stateItem) => stateItem.memoName).includes(memo.name)) // ? The Memos API could return with duplications when the pagination is in used.
          .map((memo) => getCollectionItem(memo)),
      ])
    );
  }

  public addCollectionItem(memo: MemoModel, first = false): void {
    if (first) this.collectionState.patchState('collection', (state) => [getCollectionItem(memo), ...state]);
    else this.collectionState.patchState('collection', (state) => [...state, getCollectionItem(memo)]);
  }

  public deleteCollectionItem(memoName: string): void {
    this.collectionState.patchState('collection', (state) => state.filter((item) => item.memoName !== memoName));
  }

  public updateCollectionItem(memoName: string, rawContent: string): void {
    this.collectionState.patchState('collection', (state) => {
      const index = state.findIndex((item) => item.memoName === memoName);
      if (index !== -1) state[index] = getCollectionItem({ name: memoName, content: rawContent });
      return state;
    });
  }
}
