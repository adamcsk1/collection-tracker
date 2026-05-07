import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { AiSearchInput } from './ai-search-input/ai-search-input';
import { collectionStateToken, initialCollectionState } from './collection-store';
import { List } from './list/list';
import { AiSearchService } from './search/ai-search-service';
import { SearchSuggestionService } from './search/search-suggestion-service';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

import { provideStore } from 'ngx-simple-signal-store';

@Component({
  selector: 'ct-collection',
  imports: [List, FormField, NgxSignalTranslatePipe, Autocomplete, AiSearchInput],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
  providers: [
    provideStore(initialCollectionState, collectionStateToken),
    { provide: AutocompleteService, useClass: SearchSuggestionService },
    AiSearchService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Collection {
  private readonly collectionState = inject(collectionStateToken);
  private readonly aiSearch = inject(AiSearchService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly searchTextModel = signal('');
  protected readonly aiSearchPromptTextModel = signal('');
  protected readonly searchTextField = form(this.searchTextModel);
  protected readonly aiSearchPromptTextField = form(this.aiSearchPromptTextModel);
  protected readonly aiSearchInProgress = this.aiSearch.searchInProgress.asReadonly();
  protected readonly useAiSearch = this.aiSearch.useAiSearch.asReadonly();

  constructor() {
    const querySearch = this.route.snapshot.queryParams['search'];
    if (typeof querySearch === 'string' && querySearch.trim()) {
      this.collectionState.setState('searchText', querySearch.trim());
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { search: null },
        replaceUrl: true,
      });
    }

    effect(() => {
      const searchText = this.collectionState.state.searchText();
      untracked(() => {
        if (this.searchTextModel() !== searchText) {
          this.searchTextModel.set(searchText);
        }
      });
    });

    effect(() => {
      const searchText = this.searchTextModel();
      if (this.collectionState.state.searchText() !== searchText) {
        this.collectionState.setState('searchText', searchText);
      }
    });
  }

  protected onSearchFromUser(): void {
    this.collectionState.setState('forceStandardSearch', false);
  }

  protected onSearchAccepted(): void {
    this.collectionState.setState('forceStandardSearch', true);
  }

  protected onAiSearchSend(): void {
    const aiSearchPromptText = this.aiSearchPromptTextModel();
    this.collectionState.setState('aiSearchPromptText', aiSearchPromptText);
    this.collectionState.setState('aiSearchSendVersion', this.collectionState.state.aiSearchSendVersion() + 1);
  }
}
