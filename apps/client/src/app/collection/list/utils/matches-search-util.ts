import { VIRTUAL_UNWATCHED_TAG, WATCHED_TAG } from '@shared/constants/tags-const';
import { FUZZY_CONTENT_MAX_LENGTH, hasFuzzyMatch } from '@shared/utils/fuzzy-search-util';
import { CollectionItemModel } from '../../collection-model';

export const matchesSearch = (item: CollectionItemModel, searchText: string, useFuzzySearch: boolean): boolean => {
  if (searchText === VIRTUAL_UNWATCHED_TAG) return !item.tags.includes(WATCHED_TAG);

  const lower = searchText.toLowerCase();
  const searchableTextLower = item.searchableTextLower ?? '';

  if (useFuzzySearch) {
    if (item.titleLower.includes(lower) || hasFuzzyMatch(lower, item.titleLower)) return true;
    if (!searchableTextLower.includes(lower)) {
      return searchableTextLower.length <= FUZZY_CONTENT_MAX_LENGTH && hasFuzzyMatch(lower, searchableTextLower);
    }

    return true;
  }

  return searchableTextLower.includes(lower);
};
