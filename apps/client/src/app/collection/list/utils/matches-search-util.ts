import { CollectionItemModel } from '../../collection-model';
import { VIRTUAL_UNWATCHED_TAG, WATCHED_TAG } from '@shared/constants/tags-const';
import { FUZZY_CONTENT_MAX_LENGTH, hasFuzzyMatch } from '@shared/utils/fuzzy-search-util';

export function matchesSearch(item: CollectionItemModel, searchText: string, useFuzzySearch: boolean): boolean {
  if (searchText === VIRTUAL_UNWATCHED_TAG) return !item.rawContentLower.includes(WATCHED_TAG);

  const lower = searchText.toLowerCase();

  if (useFuzzySearch) {
    if (item.titleLower.includes(lower) || hasFuzzyMatch(lower, item.titleLower)) return true;
    if (!item.rawContentLower.includes(lower)) {
      return item.rawContentLower.length <= FUZZY_CONTENT_MAX_LENGTH && hasFuzzyMatch(lower, item.rawContentLower);
    }

    return true;
  }

  return item.rawContentLower.includes(lower);
}
