import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { SearchSuggestionService, searchSuggestionListTypeToken } from '../library/search/search-suggestion-service';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { List } from '../list/list';
import { AiSearchService } from '../search/ai-search-service';
import { setupCollectionAiSearch } from '../utils/collection-ai-search-util';
import {
  buildCollectionRouteFilterKey,
  buildCollectionRouteFilters,
  setupStandardCollectionSearch,
} from '../utils/collection-search-filter-util';

@Component({
  selector: 'ct-book-tracker',
  imports: [List, FormField, Autocomplete],
  templateUrl: './book-tracker.html',
  styleUrl: '../collection.css',
  providers: [
    { provide: AutocompleteService, useClass: SearchSuggestionService },
    { provide: searchSuggestionListTypeToken, useValue: 'book-tracker' },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookTracker {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly collectionState = inject(collectionStateToken);
  private readonly aiSearch = inject(AiSearchService);
  private readonly portal = inject(PortalService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly floatActions = inject(FloatActionsService);
  private readonly mainState = inject(mainStateToken);
  private readonly route = inject(ActivatedRoute);
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
  protected readonly searchTextModel = signal('');
  protected readonly searchTextField = form(this.searchTextModel);
  protected readonly translations = {
    messageEmptyBookTracker: computed(() => this.ngxSignalTranslate.translate('Message.EmptyBookTracker')),
    messageAddFirstBookTracker: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstBookTracker')),
    placeholderSearchInBookTracker: computed(() =>
      this.ngxSignalTranslate.translate('Placeholder.SearchInBookTracker')
    ),
    placeholderReply: computed(() => this.ngxSignalTranslate.translate('Placeholder.Reply')),
  };
  private readonly aiSearchSetup = setupCollectionAiSearch({
    collectionState: this.collectionState,
    aiSearch: this.aiSearch,
    api: this.api,
    portal: this.portal,
    floatActions: this.floatActions,
    destroyRef: this.destroyRef,
    listType: 'book-tracker',
    queryFilters: this.queryFilters,
    forceStandardSearch: this.forceStandardSearch,
    placeholder: this.translations.placeholderReply,
    aiAvailable: this.mainState.state.aiAvailable,
  });
  protected readonly bookTrackerDataSource = this.aiSearchSetup.dataSource;

  constructor() {
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

  protected onAddBookTracker(event: Event): void {
    event.preventDefault();
    this.portal.open(NewItemDialog, { bookTracker: true });
  }
}
