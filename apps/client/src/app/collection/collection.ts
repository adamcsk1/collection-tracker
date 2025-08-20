import { Component } from '@angular/core';
import { CollectionBackground } from '@client/collection/collection-background/collection-background';
import { CollectionList } from '@client/collection/collection-list/collection-list';
import { CollectionSearch } from '@client/collection/collection-search/collection-search';
import { collectionStateToken, initialCollectionState } from '@client/collection/collection-store';

import { provideStore } from 'ngx-simple-signal-store';

@Component({
  selector: 'ct-collection',
  imports: [CollectionBackground, CollectionSearch, CollectionList],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
  providers: [provideStore(initialCollectionState, collectionStateToken)],
})
export class Collection {}
