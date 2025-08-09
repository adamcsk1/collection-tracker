import { Component, inject, OnInit } from '@angular/core';
import { CollectionBackground } from '@collection/collection-background/collection-background';
import { CollectionList } from '@collection/collection-list/collection-list';
import { CollectionSearch } from '@collection/collection-search/collection-search';
import { CollectionService } from '@collection/collection-service';
import { collectionStateToken, initialCollectionState } from '@collection/collection-store';
import { memosStateToken } from '@lib/services/memos/memos-store';
import { provideStore } from 'ngx-simple-signal-store';

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
