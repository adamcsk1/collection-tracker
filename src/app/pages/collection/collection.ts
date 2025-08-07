import { Component, effect, inject, OnInit, viewChild, ViewContainerRef } from '@angular/core';
import { memosStateToken } from '@lib/services/memos/memos-store';
import { provideStore } from 'ngx-simple-signal-store';
import { CollectionService } from '../../services/collection/collection-service';
import { CollectionBackground } from './collection-background/collection-background';
import { CollectionItemDialog } from './collection-item-dialog/collection-item-dialog';
import { CollectionList } from './collection-list/collection-list';
import { CollectionSearch } from './collection-search/collection-search';
import { componentCollectionStateToken, initialComponentCollectionState } from './collection-store';

@Component({
  selector: 'ct-collection',
  imports: [CollectionBackground, CollectionSearch, CollectionList],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
  providers: [provideStore(initialComponentCollectionState, componentCollectionStateToken)],
})
export class Collection implements OnInit {
  private readonly collectionService = inject(CollectionService);
  private readonly collectionDialogsRef = viewChild('collectionDialogs', { read: ViewContainerRef });
  private readonly componentCollectionState = inject(componentCollectionStateToken);
  private readonly memosState = inject(memosStateToken);

  constructor() {
    effect(() => {
      const openedCollectionItem = this.componentCollectionState.state.openedCollectionItem();

      if (!openedCollectionItem) this.collectionDialogsRef()?.clear();
      else
        this.collectionDialogsRef()
          ?.createComponent(CollectionItemDialog)
          .setInput('collectionItem', openedCollectionItem);
    });
  }

  public ngOnInit(): void {
    if (this.memosState.state.loadNetworkStatus() !== 'finished') this.collectionService.loadCollection();
  }
}
