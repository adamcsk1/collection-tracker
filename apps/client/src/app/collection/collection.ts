import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { ClaudeAiInput } from '@client/collection/claude-ai-input/claude-ai-input';
import { collectionStateToken, initialCollectionState } from '@client/collection/collection-store';
import { List } from '@client/collection/list/list';
import { ClaudeSearchService } from '@client/collection/search/claude-search-service';
import { SearchSuggestionService } from '@client/collection/search/search-suggestion-service';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

import { provideStore } from 'ngx-simple-signal-store';

@Component({
  selector: 'ct-collection',
  imports: [List, FormField, NgxSignalTranslatePipe, Autocomplete, ClaudeAiInput],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
  providers: [
    provideStore(initialCollectionState, collectionStateToken),
    { provide: AutocompleteService, useClass: SearchSuggestionService },
    ClaudeSearchService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Collection {
  private readonly collectionState = inject(collectionStateToken);
  private readonly claudeSearch = inject(ClaudeSearchService);
  protected readonly searchTextModel = signal('');
  protected readonly claudeAiPromptTextModel = signal('');
  protected readonly searchTextField = form(this.searchTextModel);
  protected readonly claudeAiPromptTextField = form(this.claudeAiPromptTextModel);
  protected readonly claudeAiInProgress = this.claudeSearch.searchInProgress.asReadonly();
  protected readonly useClaudeAi = this.claudeSearch.useClaudeAi.asReadonly();

  constructor() {
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

  protected onClaudeAiSend(): void {
    const claudeAiPromptText = this.claudeAiPromptTextModel();
    this.collectionState.setState('claudeAiPromptText', claudeAiPromptText);
    this.collectionState.setState('claudeAiSendVersion', this.collectionState.state.claudeAiSendVersion() + 1);
  }
}
