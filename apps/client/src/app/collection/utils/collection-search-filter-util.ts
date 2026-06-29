import { effect, untracked } from '@angular/core';
import { CollectionItemFiltersApiModel, CollectionListTypeModel } from '@shared/models/api-model';
import { QueryParamReader, StandardSearchSetupOptions } from './collection-search-filter-model';

export const buildStandardSearchFilters = (
  searchText: string,
  listType: CollectionListTypeModel,
  explicitFilters: Partial<CollectionItemFiltersApiModel> = {}
): CollectionItemFiltersApiModel => {
  const search = searchText.trim();
  const filters = search.startsWith('#') ? { tags: [search], tagMode: 'all' as const } : search ? { search } : {};

  return { ...filters, ...explicitFilters, listType };
};

export const buildCollectionRouteFilters = (queryParams: QueryParamReader): Partial<CollectionItemFiltersApiModel> => {
  const type = queryParams.get('type');
  const favorite = queryParams.get('favorite');
  const watched = queryParams.get('watched');
  const completed = queryParams.get('completed');

  return {
    ...(type === 'movie' || type === 'series' ? { type } : {}),
    ...(favorite === 'true' ? { favorite: true } : {}),
    ...(watched === 'false' ? { watched: false } : watched === 'true' ? { watched: true } : {}),
    ...(completed === 'false' ? { completed: false } : completed === 'true' ? { completed: true } : {}),
  };
};

export const buildCollectionRouteFilterKey = (filters: Partial<CollectionItemFiltersApiModel>): string => {
  if (
    filters.type === undefined &&
    filters.favorite === undefined &&
    filters.watched === undefined &&
    filters.completed === undefined
  ) {
    return '';
  }

  return JSON.stringify({
    type: filters.type ?? null,
    favorite: filters.favorite ?? null,
    watched: filters.watched ?? null,
    completed: filters.completed ?? null,
  });
};

export const setupStandardCollectionSearch = ({
  collectionState,
  searchTextModel,
  floatActions,
  floatSearchTemplate,
  destroyRef,
  initialSearchText = '',
}: StandardSearchSetupOptions): void => {
  collectionState.setState('searchText', initialSearchText);

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
