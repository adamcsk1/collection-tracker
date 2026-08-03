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
  '#watch-later',
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
        listType: 'watch-later',
      })
    ).toEqual({ kind: 'invalidNonLibraryTag' });
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        listType: 'watch-later',
        targetOwnerShareCode: 'shared-code',
      })
    ).toEqual({ kind: 'invalidSharedListCreate' });
    expect(createCollectionItemTagValidation({ ...baseCreateInput, listType: 'series-tracker' })).toEqual({
      kind: 'invalidSeriesTrackerTags',
    });
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        contentType: 'series',
        listType: 'series-tracker',
      })
    ).toBeUndefined();
    expect(
      createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'book', listType: 'book-tracker' })
    ).toBeUndefined();
    for (const listType of ['library', 'watch-later', 'wishlist'] as const) {
      expect(createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'book', listType })).toEqual({
        kind: 'invalidInternalCollectionTag',
      });
    }
    expect(createCollectionItemTagValidation({ ...baseCreateInput, listType: 'book-tracker' })).toEqual({
      kind: 'invalidInternalCollectionTag',
    });
    expect(
      createCollectionItemTagValidation({ ...baseCreateInput, contentType: 'series', listType: 'book-tracker' })
    ).toEqual({ kind: 'invalidInternalCollectionTag' });
    expect(
      createCollectionItemTagValidation({
        ...baseCreateInput,
        contentType: 'book',
        favorite: true,
        listType: 'book-tracker',
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
        listType: 'series-tracker',
        existingListType: 'series-tracker',
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'series',
        favorite: true,
        listType: 'series-tracker',
        existingListType: 'series-tracker',
      })
    ).toEqual({ kind: 'invalidSeriesTrackerTags' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        listType: 'watch-later',
        existingListType: 'watch-later',
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        favorite: true,
        listType: 'watch-later',
        existingListType: 'watch-later',
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
        existingListType: 'watch-later',
      })
    ).toEqual({ kind: 'invalidInternalCollectionItemUpdate' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        listType: 'watch-later',
        existingListType: 'watch-later',
        requesterIsOwner: false,
      })
    ).toEqual({ kind: 'sharedInternalCollectionItemUpdate' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'book',
        listType: 'book-tracker',
        existingListType: 'book-tracker',
      })
    ).toBeUndefined();
    for (const listType of ['library', 'watch-later', 'wishlist'] as const) {
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
        listType: 'book-tracker',
        existingListType: 'book-tracker',
      })
    ).toEqual({ kind: 'invalidInternalCollectionTag' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'series',
        listType: 'book-tracker',
        existingListType: 'book-tracker',
      })
    ).toEqual({ kind: 'invalidInternalCollectionTag' });
    expect(
      changeCollectionItemTagValidation({
        ...baseChangeInput,
        contentType: 'book',
        favorite: true,
        listType: 'book-tracker',
        existingListType: 'book-tracker',
      })
    ).toEqual({ kind: 'invalidInternalCollectionTag' });
  });

  it('returns all editable and display tags', () => {
    expect(filterEditableTags(formerSystemTags)).toEqual(formerSystemTags);
    expect(filterDisplayTags(formerSystemTags)).toEqual(formerSystemTags);
  });
});
