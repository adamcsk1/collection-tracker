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
import { form, FormField } from '@angular/forms/signals';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { mainStateToken } from '../../main/main-store';
import { collectionStateToken } from '../collection-store';
import { SearchSuggestionService, searchSuggestionListTypeToken } from '../library/search/search-suggestion-service';
import { getMediaChipEmptyIcon } from '../list/list-util';
import { List } from '../list/list';
import type { CollectionMediaChip } from '../media-chips/media-chips-model';
import { CollectionMediaChips } from '../media-chips/media-chips';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { AiSearchService } from '../search/ai-search-service';
import { setupCollectionAiSearch } from '../utils/collection-ai-search-util';
import {
  buildCollectionRouteFilterKey,
  buildCollectionRouteFilters,
  setupStandardCollectionSearch,
} from '../utils/collection-search-filter-util';
import { map } from 'rxjs';

@Component({
  selector: 'ct-up-next',
  imports: [List, FormField, Autocomplete, CollectionMediaChips],
  templateUrl: './up-next.html',
  styleUrl: '../collection.css',
  providers: [
    { provide: AutocompleteService, useClass: SearchSuggestionService },
    { provide: searchSuggestionListTypeToken, useValue: 'up-next' },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpNext {
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

  protected readonly searchTextModel = signal('');
  protected readonly queryFilters = toSignal(
    this.route.queryParamMap.pipe(map((queryParamMap) => buildCollectionRouteFilters(queryParamMap))),
    {
      initialValue: buildCollectionRouteFilters({
        get: (name) => `${this.route.snapshot.queryParams[name] ?? ''}` || null,
      }),
    }
  );
  protected readonly queryFilterKey = computed(() => buildCollectionRouteFilterKey(this.queryFilters()));
  protected readonly booksEnabled = computed(() => this.mainState.state.collectionFeaturePreferences().books);
  protected readonly mediaChips: readonly CollectionMediaChip[] = ['all', 'movie', 'series', 'book'];
  protected readonly activeMediaChip = computed((): CollectionMediaChip => {
    const type = this.queryFilters().type;
    if (type === 'movie' || type === 'series' || type === 'book') return type;
    return 'all';
  });
  protected readonly emptyIcon = computed(() => getMediaChipEmptyIcon(this.activeMediaChip()));
  protected readonly forceStandardSearch = computed(
    () => !!this.queryFilterKey() || this.collectionState.state.forceStandardSearch()
  );
  protected readonly searchTextField = form(this.searchTextModel);
  protected readonly translations = {
    messageEmptyUpNext: computed(() => this.ngxSignalTranslate.translate('Message.EmptyUpNext')),
    messageAddFirstUpNext: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstUpNext')),
    placeholderSearchInUpNext: computed(() => this.ngxSignalTranslate.translate('Placeholder.SearchInUpNext')),
    placeholderReply: computed(() => this.ngxSignalTranslate.translate('Placeholder.Reply')),
  };
  private readonly aiSearchSetup = setupCollectionAiSearch({
    collectionState: this.collectionState,
    aiSearch: this.aiSearch,
    api: this.api,
    portal: this.portal,
    floatActions: this.floatActions,
    destroyRef: this.destroyRef,
    listType: 'up-next',
    queryFilters: this.queryFilters,
    forceStandardSearch: this.forceStandardSearch,
    placeholder: this.translations.placeholderReply,
    aiAvailable: this.mainState.state.aiAvailable,
  });
  protected readonly upNextDataSource = this.aiSearchSetup.dataSource;

  constructor() {
    setupStandardCollectionSearch({
      collectionState: this.collectionState,
      searchTextModel: this.searchTextModel,
      floatActions: this.floatActions,
      floatSearchTemplate: this.floatSearchTemplate,
      destroyRef: this.destroyRef,
    });
  }

  protected onSearchFromUser(): void {
    this.aiSearchSetup.clearAiFilterOnStandardSearch();
  }

  protected onAddUpNext(event: Event): void {
    event.preventDefault();
    this.portal.open(NewItemDialog, { upNext: true });
  }
}
