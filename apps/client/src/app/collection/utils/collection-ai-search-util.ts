import { computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { form } from '@angular/forms/signals';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import type { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';
import { catchError, debounceTime, EMPTY, startWith, switchMap } from 'rxjs';
import { mainCollectionStateToken } from '../../main/main-collection-store';
import type { CollectionListDataSource, CollectionListDataSourceRequest } from '../collection-model';
import { AiSearchDialog } from '../search/ai-search-dialog';
import type { CollectionAiSearchSetup, CollectionAiSearchSetupOptions } from './collection-ai-search-model';
import { buildStandardSearchFilters } from './collection-search-filter-util';

const toMatchedIdentity = (candidateId: string): ExternalItemIdentityModel => {
  const separatorIndex = candidateId.indexOf(':');
  if (separatorIndex > 0) {
    const source = candidateId.slice(0, separatorIndex);
    const id = candidateId.slice(separatorIndex + 1);
    if (id && isExternalItemIdentitySourceName(source)) return { source, id };
  }

  return { source: 'imdb', id: candidateId };
};

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
      switchMap(({ promptText }) => aiSearch.getMatchedIds(promptText, listType)),
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

  let destroyed = false;

  effect(() => {
    const available = aiAvailable();
    const active = aiFilterActive();
    untracked(() => {
      if (destroyed) return;
      floatActions.setAiSearchAction(available, active, () => {
        checkAiAvailableOnOpen();
        openAiSearchDialog();
      });
    });
  });

  destroyRef.onDestroy(() => {
    destroyed = true;
    collectionState.setState('aiSearchPromptText', '');
    collectionState.setState('aiSearchSendVersion', 0);
    floatActions.setAiSearchAction(false, false);
  });

  const dataSource: CollectionListDataSource = ({
    cursor,
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
        identities: (aiIds as string[]).map(toMatchedIdentity),
        cursor: cursor ?? undefined,
        limit,
        filters: { listType },
      });
    }

    const filters = buildStandardSearchFilters(searchText, listType, queryFilters());
    return api.searchItems({ ...filters, orderBy, orderDirection }, cursor, limit);
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
