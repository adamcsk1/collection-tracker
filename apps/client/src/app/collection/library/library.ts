import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form, FormField } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { map } from 'rxjs';
import { AiSearchInput } from './ai-search-input/ai-search-input';
import { collectionStateToken } from '../collection-store';
import { List } from '../list/list';
import { AiSearchService } from '../search/ai-search-service';
import { SearchSuggestionService } from './search/search-suggestion-service';

@Component({
  selector: 'ct-collection-library',
  imports: [List, FormField, Autocomplete, AiSearchInput],
  templateUrl: './library.html',
  styleUrl: '../collection.css',
  providers: [{ provide: AutocompleteService, useClass: SearchSuggestionService }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionLibrary {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly collectionState = inject(collectionStateToken);
  private readonly aiSearch = inject(AiSearchService);
  private readonly route = inject(ActivatedRoute);
  protected readonly querySearch = toSignal(
    this.route.queryParamMap.pipe(map((queryParamMap) => queryParamMap.get('search')?.trim() ?? '')),
    { initialValue: this.route.snapshot.queryParams['search']?.trim?.() ?? '' }
  );
  protected readonly translations = {
    placeholderReply: computed(() => this.ngxSignalTranslate.translate('Placeholder.Reply')),
    placeholderSearchInCollection: computed(() => this.ngxSignalTranslate.translate('Placeholder.SearchInCollection')),
  };
  protected readonly searchTextModel = signal('');
  protected readonly aiSearchPromptTextModel = signal('');
  protected readonly searchTextField = form(this.searchTextModel);
  protected readonly aiSearchPromptTextField = form(this.aiSearchPromptTextModel);
  protected readonly aiSearchInProgress = this.aiSearch.searchInProgress.asReadonly();
  protected readonly useAiSearch = this.aiSearch.useAiSearch.asReadonly();
  protected readonly useStandardSearch = computed(
    () => !this.useAiSearch() || this.collectionState.state.forceStandardSearch()
  );

  constructor() {
    effect(() => {
      const querySearch = this.querySearch();

      untracked(() => {
        this.collectionState.setState('forceStandardSearch', !!querySearch);
        this.collectionState.setState('searchText', querySearch);
      });
    });

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
    if (this.collectionState.state.forceStandardSearch()) {
      this.collectionState.setState('forceStandardSearch', false);
    }
  }

  protected onSearchAccepted(): void {
    if (this.aiSearch.useAiSearch() && !this.collectionState.state.forceStandardSearch()) {
      this.collectionState.setState('forceStandardSearch', true);
    }
  }

  protected onAiSearchSend(): void {
    const aiSearchPromptText = this.aiSearchPromptTextModel();
    this.collectionState.setState('aiSearchPromptText', aiSearchPromptText);
    this.collectionState.setState('aiSearchSendVersion', this.collectionState.state.aiSearchSendVersion() + 1);
  }
}
