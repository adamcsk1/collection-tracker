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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { form, FormField } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { map } from 'rxjs';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { mainStateToken } from '../../main/main-store';
import { collectionStateToken } from '../collection-store';
import { ItemDialog } from '../item/item-dialog/item-dialog';
import { List } from '../list/list';
import { AiSearchService } from '../search/ai-search-service';
import { setupCollectionAiSearch } from '../utils/collection-ai-search-util';
import {
  buildCollectionRouteFilterKey,
  buildCollectionRouteFilters,
  setupStandardCollectionSearch,
} from '../utils/collection-search-filter-util';
import { SearchSuggestionService } from './search/search-suggestion-service';

@Component({
  selector: 'ct-collection-library',
  imports: [List, FormField, Autocomplete],
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
  private readonly mainState = inject(mainStateToken);
  private readonly floatActions = inject(FloatActionsService);
  private readonly floatSearchTemplate = viewChild<TemplateRef<unknown>>('floatSearch');
  protected readonly querySearch = toSignal(
    this.route.queryParamMap.pipe(map((queryParamMap) => queryParamMap.get('search')?.trim() ?? '')),
    { initialValue: this.route.snapshot.queryParams['search']?.trim?.() ?? '' }
  );
  protected readonly queryFilters = toSignal(
    this.route.queryParamMap.pipe(map((queryParamMap) => buildCollectionRouteFilters(queryParamMap))),
    {
      initialValue: buildCollectionRouteFilters({
        get: (name) => `${this.route.snapshot.queryParams[name] ?? ''}` || null,
      }),
    }
  );
  protected readonly queryFilterKey = computed(() => buildCollectionRouteFilterKey(this.queryFilters()));
  protected readonly forceStandardSearch = computed(
    () => !!this.querySearch() || !!this.queryFilterKey() || this.collectionState.state.forceStandardSearch()
  );
  protected readonly translations = {
    placeholderReply: computed(() => this.ngxSignalTranslate.translate('Placeholder.Reply')),
    placeholderSearchInCollection: computed(() => this.ngxSignalTranslate.translate('Placeholder.SearchInCollection')),
  };
  protected readonly searchTextModel = signal('');
  protected readonly searchTextField = form(this.searchTextModel);
  private readonly aiSearchSetup = setupCollectionAiSearch({
    collectionState: this.collectionState,
    aiSearch: this.aiSearch,
    api: this.api,
    portal: this.portal,
    floatActions: this.floatActions,
    destroyRef: this.destroyRef,
    listType: 'library',
    queryFilters: this.queryFilters,
    forceStandardSearch: this.forceStandardSearch,
    placeholder: this.translations.placeholderReply,
    aiAvailable: this.mainState.state.aiAvailable,
  });
  protected readonly collectionDataSource = this.aiSearchSetup.dataSource;

  constructor() {
    effect(() => {
      const querySearch = this.querySearch();
      const queryFilterKey = this.queryFilterKey();

      untracked(() => {
        const forceStandard = !!querySearch || !!queryFilterKey;
        this.collectionState.setState('forceStandardSearch', forceStandard);
        if (forceStandard) {
          this.collectionState.setState('aiSearchPromptText', '');
        }
        this.collectionState.setState('searchText', querySearch);
      });
    });

    setupStandardCollectionSearch({
      collectionState: this.collectionState,
      searchTextModel: this.searchTextModel,
      floatActions: this.floatActions,
      floatSearchTemplate: this.floatSearchTemplate,
      destroyRef: this.destroyRef,
      initialSearchText: this.querySearch(),
    });
  }

  protected onSearchFromUser(): void {
    this.aiSearchSetup.clearAiFilterOnStandardSearch();
  }

  protected onSearchAccepted(): void {
    this.aiSearchSetup.clearAiFilterOnStandardSearch();
  }

  protected onRandomPick(): void {
    this.api
      .getRandomItem()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((item) => this.portal.open(ItemDialog, { collectionItem: item }));
  }

  protected onShowFunctions(): void {
    this.aiSearchSetup.checkAiAvailableOnOpen();
  }
}
