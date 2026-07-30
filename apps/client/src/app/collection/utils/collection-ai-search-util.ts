import { computed, DestroyRef, effect, inject, Signal, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FieldTree, form } from '@angular/forms/signals';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { CollectionItemFiltersApiModel, CollectionListTypeModel } from '@shared/models/api-model';
import { NgxSimpleSignalStoreService } from 'ngx-simple-signal-store';
import { catchError, debounceTime, EMPTY, startWith, switchMap } from 'rxjs';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { mainCollectionStateToken } from '../../main/main-collection-store';
import { CollectionListDataSource, CollectionListDataSourceRequest } from '../collection-model';
import { CollectionState } from '../collection-store';
import { AiSearchDialog } from '../search/ai-search-dialog';
import { AiSearchService } from '../search/ai-search-service';
import { buildStandardSearchFilters } from './collection-search-filter-util';

export interface CollectionAiSearchSetupOptions {
  collectionState: NgxSimpleSignalStoreService<CollectionState>;
  aiSearch: AiSearchService;
  api: ApiService;
  portal: PortalService;
  floatActions: FloatActionsService;
  destroyRef: DestroyRef;
  listType: CollectionListTypeModel;
  queryFilters: Signal<Partial<CollectionItemFiltersApiModel>>;
  forceStandardSearch?: Signal<boolean>;
  placeholder: Signal<string>;
  aiAvailable: Signal<boolean>;
}

export interface CollectionAiSearchSetup {
  dataSource: CollectionListDataSource;
  aiSearchPromptTextField: FieldTree<string>;
  aiFilterActive: Signal<boolean>;
  clearAiFilterOnStandardSearch: () => void;
  openAiSearchDialog: () => void;
  checkAiAvailableOnOpen: () => void;
}

export const setupCollectionAiSearch = ({
  collectionState,
  aiSearch,
  api,
  portal,
  floatActions,
  destroyRef,
  listType,
  queryFilters,
  forceStandardSearch = signal(false),
  placeholder,
  aiAvailable,
}: CollectionAiSearchSetupOptions): CollectionAiSearchSetup => {
  const mainCollectionState = inject(mainCollectionStateToken);
  const aiSearchPromptTextModel = signal(collectionState.state.aiSearchPromptText());
  const aiSearchPromptTextField = form(aiSearchPromptTextModel);

  aiSearch.setListType(listType);
  collectionState.setState('aiSearchPromptText', '');
  collectionState.setState('aiSearchSendVersion', 0);
  aiSearchPromptTextModel.set('');

  const aiSearchSendTrigger = computed(() => ({
    promptText: collectionState.state.aiSearchPromptText(),
    version: collectionState.state.aiSearchSendVersion(),
  }));

  const aiSearchMatchedIds = toSignal(
    toObservable(aiSearchSendTrigger).pipe(
      debounceTime(500),
      switchMap(({ promptText }) => aiSearch.getMatchedIds(promptText)),
      startWith(null)
    ),
    { initialValue: null }
  );

  const aiFilterActive = computed(() => !!collectionState.state.aiSearchPromptText().trim() && !forceStandardSearch());

  const openAiSearchDialog = (): void => {
    aiSearchPromptTextModel.set(collectionState.state.aiSearchPromptText());
    portal.open(AiSearchDialog, {
      formField: aiSearchPromptTextField,
      placeholder: placeholder(),
      send: () => {
        const aiSearchPromptText = aiSearchPromptTextModel().trim();
        collectionState.setState('aiSearchPromptText', aiSearchPromptText);
        collectionState.setState('forceStandardSearch', false);
        collectionState.setState('aiSearchSendVersion', collectionState.state.aiSearchSendVersion() + 1);
        if (!aiSearchPromptText) {
          mainCollectionState.setState('reloadTrigger', mainCollectionState.state.reloadTrigger() + 1);
        }
      },
    });
  };

  const clearAiFilterOnStandardSearch = (): void => {
    if (collectionState.state.aiSearchPromptText().trim()) {
      collectionState.setState('aiSearchPromptText', '');
      collectionState.setState('aiSearchSendVersion', collectionState.state.aiSearchSendVersion() + 1);
    }
    collectionState.setState('forceStandardSearch', true);
  };

  const checkAiAvailableOnOpen = (): void => {
    aiSearch
      .checkAiAvailable()
      .pipe(
        takeUntilDestroyed(destroyRef),
        catchError(() => EMPTY)
      )
      .subscribe();
  };

  effect(() => {
    aiSearchMatchedIds();
    untracked(() => {
      if (aiFilterActive()) {
        mainCollectionState.setState('reloadTrigger', mainCollectionState.state.reloadTrigger() + 1);
      }
    });
  });

  effect(() => {
    const available = aiAvailable();
    const active = aiFilterActive();
    untracked(() => {
      floatActions.setAiSearchAction(available, active, () => {
        checkAiAvailableOnOpen();
        openAiSearchDialog();
      });
    });
  });

  destroyRef.onDestroy(() => {
    floatActions.setAiSearchAction(false, false);
    collectionState.setState('aiSearchPromptText', '');
    collectionState.setState('aiSearchSendVersion', 0);
  });

  const dataSource: CollectionListDataSource = ({
    offset,
    limit,
    searchText,
    orderBy,
    orderDirection,
  }: CollectionListDataSourceRequest) => {
    const aiIds = aiSearchMatchedIds();
    const promptText = collectionState.state.aiSearchPromptText().trim();
    const useAiFilter = !!promptText && !forceStandardSearch();

    if (useAiFilter && aiIds === null) {
      return EMPTY;
    }

    if (useAiFilter) {
      return api.getMatchedItems({
        identities: (aiIds as string[]).map((id) => ({ source: 'imdb', id })),
        offset,
        limit,
        filters: { listType },
      });
    }

    const filters = buildStandardSearchFilters(searchText, listType, queryFilters());
    return api.searchItems({ ...filters, orderBy, orderDirection }, offset, limit);
  };

  return {
    dataSource,
    aiSearchPromptTextField,
    aiFilterActive,
    clearAiFilterOnStandardSearch,
    openAiSearchDialog,
    checkAiAvailableOnOpen,
  };
};
