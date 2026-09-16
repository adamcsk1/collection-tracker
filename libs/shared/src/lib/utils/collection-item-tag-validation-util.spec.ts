import {
  changeCollectionItemTagValidation,
  createCollectionItemTagValidation,
} from './collection-item-tag-validation-util';

const baseCreateInput = { contentType: 'movie' as const, favorite: false };
const baseChangeInput = { contentType: 'movie' as const, favorite: false, requesterIsOwner: true };

describe('collection item tag validation util', () => {
  it('validates create item list constraints', () => {
    expect(createCollectionItemTagValidation({ ...baseCreateInput, listType: 'library' })).toBeUndefined();
    expect(createCollectionItemTagValidation({ ...baseCreateInput, favorite: true, listType: 'up-next' })).toEqual({
      kind: 'invalidNonLibraryTag',
    });
    expect(createCollectionItemTagValidation({ ...baseCreateInput, listType: 'books' })).toEqual({
      kind: 'invalidInternalCollectionTag',
    });
    expect(
      createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'book', listType: 'books', favorite: true })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'album', listType: 'music' })
    ).toBeUndefined();
  });

  it('validates change item list constraints and error precedence', () => {
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'book',
        favorite: true,
        listType: 'library',
        existingListType: 'up-next',
      })
    ).toEqual({ kind: 'invalidInternalCollectionItemUpdate' });
    expect(
      changeCollectionItemTagValidation({ ...baseChangeInput, listType: 'books', existingListType: 'books' })
    ).toEqual({ kind: 'invalidInternalCollectionTag' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'series',
        favorite: true,
        listType: 'tracking',
        existingListType: 'tracking',
      })
    ).toEqual({ kind: 'invalidTrackingTags' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        favorite: true,
        listType: 'wishlist',
        existingListType: 'wishlist',
      })
    ).toEqual({ kind: 'invalidNonLibraryTag' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'book',
        favorite: true,
        listType: 'books',
        existingListType: 'books',
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'album',
        listType: 'music',
        existingListType: 'music',
      })
    ).toBeUndefined();
  });
});
