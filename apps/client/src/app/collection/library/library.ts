import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { form, FormField } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, debounceTime, EMPTY, map, startWith, switchMap } from 'rxjs';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { mainCollectionStateToken } from '../../main/main-collection-store';
import { CollectionListDataSourceRequest } from '../collection-model';
import { collectionStateToken } from '../collection-store';
import { ItemDialog } from '../item-dialog/item-dialog';
import { List } from '../list/list';
import { AiSearchService } from '../search/ai-search-service';
import { buildStandardSearchFilters } from '../utils/collection-search-filter-util';
import { AiSearchInput } from './ai-search/ai-search-input';
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
  private readonly api = inject(ApiService);
  private readonly portal = inject(PortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly floatActions = inject(FloatActionsService);
  private readonly floatSearchTemplate = viewChild<TemplateRef<unknown>>('floatSearch');
  private readonly aiSearchSendTrigger = computed(() => ({
    promptText: this.collectionState.state.aiSearchPromptText(),
    version: this.collectionState.state.aiSearchSendVersion(),
  }));
  private readonly aiSearchMatchedIds = toSignal(
    toObservable(this.aiSearchSendTrigger).pipe(
      debounceTime(500),
      switchMap(({ promptText }) => this.aiSearch.getMatchedIds(promptText)),
      startWith(null)
    ),
    { initialValue: null }
  );
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
  protected readonly collectionDataSource = ({ offset, limit, searchText }: CollectionListDataSourceRequest) => {
    const aiIds = this.aiSearchMatchedIds();
    const promptText = this.collectionState.state.aiSearchPromptText().trim();
    const useAiSearch = this.aiSearch.useAiSearch() && !this.collectionState.state.forceStandardSearch();

    if (useAiSearch && promptText && aiIds === null) {
      return EMPTY;
    }

    return useAiSearch
      ? promptText
        ? this.api.getMatchedItems({ imdbIds: aiIds as string[], offset, limit })
        : this.api.searchItems({ listType: 'library' }, offset, limit)
      : this.api.searchItems(buildStandardSearchFilters(searchText, 'library'), offset, limit);
  };

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

    effect(() => {
      this.aiSearchMatchedIds();
      untracked(() => {
        if (this.aiSearch.useAiSearch() && this.collectionState.state.aiSearchPromptText().trim()) {
          this.mainCollectionState.setState('reloadTrigger', this.mainCollectionState.state.reloadTrigger() + 1);
        }
      });
    });

    effect(() => {
      this.floatActions.setSearchTemplate(this.floatSearchTemplate() ?? null);
    });

    this.destroyRef.onDestroy(() => this.floatActions.setSearchTemplate(null));
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

  protected onRandomPick(): void {
    this.api
      .getRandomItem()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((item) => this.portal.open(ItemDialog, { collectionItem: item }));
  }

  protected onToggleAiSearch(): void {
    this.aiSearch.useAiSearch.set(!this.aiSearch.useAiSearch());
    this.collectionState.setState('searchText', '');
  }

  protected onShowFunctions(): void {
    this.aiSearch
      .checkAiAvailable()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => EMPTY)
      )
      .subscribe();
  }
}
