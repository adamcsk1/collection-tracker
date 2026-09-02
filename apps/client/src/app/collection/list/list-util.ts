import { CollectionItemContentTypeModel, CollectionListTypeModel } from '@shared/models/api-model';
import type { CollectionMediaChip } from '../media-chips/media-chips-model';

export const getMediaChipEmptyIcon = (chip: CollectionMediaChip): string => {
  switch (chip) {
    case 'movie':
      return 'movie';
    case 'series':
      return 'live_tv';
    case 'book':
      return 'menu_book';
    case 'album':
      return 'album';
    default:
      return 'local_library';
  }
};

export const getAllowedAddContentTypes = (
  listType: CollectionListTypeModel,
  lockedType: CollectionItemContentTypeModel | undefined,
  booksEnabled: boolean,
  musicEnabled = false
): readonly CollectionItemContentTypeModel[] => {
  if (lockedType) return [lockedType];

  if (listType === 'books') return ['book'];
  if (listType === 'music') return ['album'];
  if (listType === 'tracking') {
    const types: CollectionItemContentTypeModel[] = ['movie', 'series'];
    if (booksEnabled) types.push('book');
    if (musicEnabled) types.push('album');
    return types;
  }

  const types: CollectionItemContentTypeModel[] = ['movie', 'series'];
  if (booksEnabled && (listType === 'library' || listType === 'wishlist' || listType === 'up-next')) {
    types.push('book');
  }
  if (musicEnabled && (listType === 'library' || listType === 'wishlist' || listType === 'up-next')) {
    types.push('album');
  }
  return types;
};
