import { Component, inject, OnInit } from '@angular/core';
import { memosStateToken } from '@lib/services/memos/memos-store';
import { CollectionService } from '@services/collection/collection-service';
import { provideStore } from 'ngx-simple-signal-store';
import { CollectionBackground } from './collection-background/collection-background';
import { CollectionList } from './collection-list/collection-list';
import { CollectionSearch } from './collection-search/collection-search';
import { collectionStateToken, initialCollectionState } from './collection-store';

@Component({
  selector: 'ct-collection',
  imports: [CollectionBackground, CollectionSearch, CollectionList],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
  providers: [provideStore(initialCollectionState, collectionStateToken)],
})
export class Collection implements OnInit {
  private readonly collectionService = inject(CollectionService);
  private readonly memosState = inject(memosStateToken);

  public ngOnInit(): void {
    if (this.memosState.state.loadNetworkStatus() !== 'finished') this.collectionService.loadCollection();
  }
}
