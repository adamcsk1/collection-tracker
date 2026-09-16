import {
  changeCollectionItemTagValidation,
  createCollectionItemTagValidation,
} from './collection-item-tag-validation-util';

const baseCreateInput = { contentType: 'movie' as const, favorite: false };
const baseChangeInput = { contentType: 'movie' as const, favorite: false, requesterIsOwner: true };

describe('collection item tag validation util', () => {
  it('validates create item list constraints', () => {
    expect(createCollectionItemTagValidation({ ...baseCreateInput, listType: 'library' })).toBeUndefined();
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        favorite: true,
        listType: 'up-next',
      })
    ).toEqual({ kind: 'invalidNonLibraryTag' });
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        listType: 'up-next',
        targetOwnerShareCode: 'shared-code',
      })
    ).toBeUndefined();
    expect(createCollectionItemTagValidation({ ...baseCreateInput, listType: 'tracking' })).toBeUndefined();
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        contentType: 'series',
        listType: 'tracking',
      })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        contentType: 'book',
        listType: 'tracking',
      })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        contentType: 'book',
        listType: 'wishlist',
      })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        contentType: 'book',
        listType: 'up-next',
      })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'book', listType: 'books' })
    ).toBeUndefined();
    expect(createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'book', listType: 'library' })).toEqual(
      {
        kind: 'invalidInternalCollectionTag',
      }
    );
    expect(createCollectionItemTagValidation({ ...baseCreateInput, listType: 'books' })).toEqual({
      kind: 'invalidInternalCollectionTag',
    });
    expect(createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'series', listType: 'books' })).toEqual(
      { kind: 'invalidInternalCollectionTag' }
    );
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        contentType: 'book',
        favorite: true,
        listType: 'books',
      })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        contentType: 'book',
        favorite: true,
        listType: 'tracking',
      })
    ).toEqual({ kind: 'invalidNonLibraryTag' });
    expect(
      createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'album', listType: 'music' })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'album', listType: 'tracking' })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'album', listType: 'wishlist' })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'album', listType: 'up-next' })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'album', listType: 'library' })
    ).toEqual({ kind: 'invalidInternalCollectionTag' });
    expect(createCollectionItemTagValidation({ ...baseCreateInput, listType: 'music' })).toEqual({
      kind: 'invalidInternalCollectionTag',
    });
  });

  it('validates change item list constraints', () => {
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        listType: 'library',
        existingListType: 'library',
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'series',
        listType: 'tracking',
        existingListType: 'tracking',
      })
    ).toBeUndefined();
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
        listType: 'up-next',
        existingListType: 'up-next',
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        favorite: true,
        listType: 'up-next',
        existingListType: 'up-next',
      })
    ).toEqual({ kind: 'invalidNonLibraryTag' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        listType: 'wishlist',
        existingListType: 'wishlist',
      })
    ).toBeUndefined();
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
        listType: 'library',
        existingListType: 'up-next',
      })
    ).toEqual({ kind: 'invalidInternalCollectionItemUpdate' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        listType: 'up-next',
        existingListType: 'up-next',
        requesterIsOwner: false,
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'book',
        listType: 'books',
        existingListType: 'books',
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'book',
        listType: 'wishlist',
        existingListType: 'wishlist',
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        listType: 'books',
        existingListType: 'books',
      })
    ).toEqual({ kind: 'invalidInternalCollectionTag' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'series',
        listType: 'books',
        existingListType: 'books',
      })
    ).toEqual({ kind: 'invalidInternalCollectionTag' });
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
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'album',
        listType: 'tracking',
        existingListType: 'tracking',
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        listType: 'music',
        existingListType: 'music',
      })
    ).toEqual({ kind: 'invalidInternalCollectionTag' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'album',
        favorite: true,
        listType: 'music',
        existingListType: 'music',
      })
    ).toBeUndefined();
  });
});
