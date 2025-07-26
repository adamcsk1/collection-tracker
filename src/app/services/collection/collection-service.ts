import { inject, Injectable } from '@angular/core';
import { MemosService } from '@services/memos-service';
import { collectionStateToken } from '@stores/collection-store';
import { CollectionItemModel } from '../../pages/collection/collection.model';
import { getGenre } from './utils/get-genre-util';
import { getImage } from './utils/get-image-util';
import { getIMDbId } from './utils/get-imdb-id.util';
import { getTags } from './utils/get-tags.util';
import { getTitle } from './utils/get-title-util';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly memos = inject(MemosService);
  private readonly collectionState = inject(collectionStateToken);

  public loadCollection(): void {
    this.collectionState.setState('collection', []);
    this.memos.getMemos().subscribe((memos) =>
      this.collectionState.patchState('collection', (state) => [
        ...state,
        ...memos
          .filter((memo) => !state.map((stateItem) => stateItem.memoName).includes(memo.name)) // ?? tmp
          .map(
            (memo) =>
              ({
                rawContent: memo.content,
                image: getImage(memo.content),
                title: getTitle(memo.content),
                genre: getGenre(memo.content),
                tags: getTags(memo.content),
                IMDbId: getIMDbId(memo.content),
                memoName: memo.name,
              }) as CollectionItemModel
          ),
      ])
    );
  }
}
