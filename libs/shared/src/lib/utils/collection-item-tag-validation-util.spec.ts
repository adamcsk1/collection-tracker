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
        listType: 'watchlist',
      })
    ).toEqual({ kind: 'invalidNonLibraryTag' });
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        listType: 'watchlist',
        targetOwnerShareCode: 'shared-code',
      })
    ).toEqual({ kind: 'invalidSharedListCreate' });
    expect(createCollectionItemTagValidation({ ...baseCreateInput, listType: 'watching' })).toEqual({
      kind: 'invalidWatchingTags',
    });
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        contentType: 'series',
        listType: 'watching',
      })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'book', listType: 'books' })
    ).toBeUndefined();
    for (const listType of ['library', 'watchlist', 'wishlist'] as const) {
      expect(createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'book', listType })).toEqual({
        kind: 'invalidInternalCollectionTag',
      });
    }
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
        listType: 'watching',
        existingListType: 'watching',
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'series',
        favorite: true,
        listType: 'watching',
        existingListType: 'watching',
      })
    ).toEqual({ kind: 'invalidWatchingTags' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        listType: 'watchlist',
        existingListType: 'watchlist',
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        favorite: true,
        listType: 'watchlist',
        existingListType: 'watchlist',
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
        existingListType: 'watchlist',
      })
    ).toEqual({ kind: 'invalidInternalCollectionItemUpdate' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        listType: 'watchlist',
        existingListType: 'watchlist',
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
    for (const listType of ['library', 'watchlist', 'wishlist'] as const) {
      expect(
        changeCollectionItemTagValidation({
          ...baseChangeInput,
          contentType: 'book',
          listType,
          existingListType: listType,
        })
      ).toEqual({ kind: 'invalidInternalCollectionTag' });
    }
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
    ).toEqual({ kind: 'invalidInternalCollectionTag' });
  });

  it('returns all editable and display tags', () => {
    expect(filterEditableTags(formerSystemTags)).toEqual(formerSystemTags);
    expect(filterDisplayTags(formerSystemTags)).toEqual(formerSystemTags);
  });
});
