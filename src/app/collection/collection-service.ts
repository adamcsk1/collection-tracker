import { effect, inject, Injectable } from '@angular/core';
import { appCollectionStateToken } from '@appCollectionStore';
import { getCollectionItem } from '@collection/utils/get-collection-item-util';
import { MemoModel } from '@lib/services/memos/memos-model';
import { MemosService } from '@lib/services/memos/memos-service';
import { memosStateToken } from '@lib/services/memos/memos-store';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly memos = inject(MemosService);
  private readonly appCollectionState = inject(appCollectionStateToken);
  private readonly memosState = inject(memosStateToken);

  constructor() {
    effect(() => {
      const loadNetworkStatus = this.memosState.state.loadNetworkStatus();

      // ?  Reorder by createTime because the Memos API does not return the items in a different correct order.
      if (loadNetworkStatus === 'finished') {
        this.appCollectionState.patchState('collection', (state) =>
          state.sort((a, b) => -a.createTime.localeCompare(b.createTime))
        );
      }
    });
  }

  public loadCollection(): void {
    if (this.memosState.state.loadNetworkStatus() === 'pending') return;

    this.memos.getMemos().subscribe((memos) =>
      this.appCollectionState.patchState('collection', (state) => [
        ...state,
        ...memos
          .filter((memo) => !state.map((stateItem) => stateItem.memoName).includes(memo.name)) // ? The Memos API could return with duplications when the pagination is in used.
          .map((memo) => getCollectionItem(memo)),
      ])
    );
  }

  public addCollectionItem(memo: MemoModel, first = false): void {
    if (first) this.appCollectionState.patchState('collection', (state) => [getCollectionItem(memo), ...state]);
    else this.appCollectionState.patchState('collection', (state) => [...state, getCollectionItem(memo)]);
  }

  public deleteCollectionItem(memoName: string): void {
    this.appCollectionState.patchState('collection', (state) => state.filter((item) => item.memoName !== memoName));
  }

  public updateCollectionItem(memoName: string, rawContent: string): void {
    this.appCollectionState.patchState('collection', (state) => {
      const index = state.findIndex((item) => item.memoName === memoName);
      if (index !== -1) state[index] = getCollectionItem({ name: memoName, content: rawContent });
      return state;
    });
  }
}
