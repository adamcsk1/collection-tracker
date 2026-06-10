import { effect, untracked } from '@angular/core';
import { VIRTUAL_UNCOMPLETED_TAG, VIRTUAL_UNWATCHED_TAG } from '@shared/constants/tags-const';
import { CollectionItemFiltersApiModel, CollectionListTypeModel } from '@shared/models/api-model';
import { StandardSearchSetupOptions } from './collection-search-filter-model';

export const buildStandardSearchFilters = (
  searchText: string,
  listType: CollectionListTypeModel
): CollectionItemFiltersApiModel => {
  const search = searchText.trim();
  if (search === VIRTUAL_UNWATCHED_TAG) return { watched: false, listType };
  if (search === VIRTUAL_UNCOMPLETED_TAG) return { completed: false, listType };
  if (search.startsWith('#')) return { tags: [search], tagMode: 'all', listType };
  return search ? { search, listType } : { listType };
};

export const setupStandardCollectionSearch = ({
  collectionState,
  searchTextModel,
  floatActions,
  floatSearchTemplate,
  destroyRef,
}: StandardSearchSetupOptions): void => {
  collectionState.setState('searchText', '');

  effect(() => {
    const searchText = collectionState.state.searchText();
    untracked(() => {
      if (searchTextModel() !== searchText) {
        searchTextModel.set(searchText);
      }
    });
  });

  effect(() => {
    const searchText = searchTextModel();
    if (collectionState.state.searchText() !== searchText) {
      collectionState.setState('searchText', searchText);
    }
  });

  effect(() => {
    floatActions.setSearchTemplate(floatSearchTemplate() ?? null);
  });

  destroyRef.onDestroy(() => floatActions.setSearchTemplate(null));
};
