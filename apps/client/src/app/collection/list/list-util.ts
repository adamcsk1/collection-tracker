import { CollectionItemContentTypeModel, CollectionListTypeModel } from '@shared/models/api-model';
import type { CollectionMediaChip } from '../media-chips/media-chips';

export const getMediaChipEmptyIcon = (chip: CollectionMediaChip): string => {
  switch (chip) {
    case 'movie':
      return 'movie';
    case 'series':
      return 'live_tv';
    case 'book':
      return 'menu_book';
    default:
      return 'local_library';
  }
};

export const getAllowedAddContentTypes = (
  listType: CollectionListTypeModel,
  lockedType: CollectionItemContentTypeModel | undefined,
  booksEnabled: boolean
): readonly CollectionItemContentTypeModel[] => {
  if (lockedType) return [lockedType];

  if (listType === 'books') return ['book'];
  if (listType === 'tracking') {
    const types: CollectionItemContentTypeModel[] = ['movie', 'series'];
    if (booksEnabled) types.push('book');
    return types;
  }

  const types: CollectionItemContentTypeModel[] = ['movie', 'series'];
  if (booksEnabled && (listType === 'library' || listType === 'wishlist' || listType === 'up-next')) {
    types.push('book');
  }
  return types;
};
