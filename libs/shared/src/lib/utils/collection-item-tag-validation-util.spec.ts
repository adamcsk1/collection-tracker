import {
  changeCollectionItemTagValidation,
  createCollectionItemTagValidation,
  filterDisplayTags,
  filterEditableTags,
} from './collection-item-tag-validation-util';

const baseCreateInput = { contentType: 'movie' as const, favorite: false };
const baseChangeInput = { contentType: 'movie' as const, favorite: false, requesterIsOwner: true };
const formerSystemTags = [
  '#completed',
  '#favorite',
  '#watchlist',
  '#wishlist',
  '#movie',
  '#series',
  '#unwatched',
  '#uncompleted',
  '#episode-s01e02',
];

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
    ).toEqual({ kind: 'invalidSharedListCreate' });
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
    ).toEqual({ kind: 'sharedInternalCollectionItemUpdate' });
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
  });

  it('returns all editable and display tags', () => {
    expect(filterEditableTags(formerSystemTags)).toEqual(formerSystemTags);
    expect(filterDisplayTags(formerSystemTags)).toEqual(formerSystemTags);
  });
});
