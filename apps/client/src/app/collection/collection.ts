import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { provideStore } from 'ngx-simple-signal-store';
import { collectionStateToken, initialCollectionState } from './collection-store';
import { AiSearchService } from './search/ai-search-service';

@Component({
  selector: 'ct-collection',
  imports: [RouterOutlet],
  templateUrl: './collection.html',
  providers: [provideStore(initialCollectionState, collectionStateToken), AiSearchService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Collection {}
