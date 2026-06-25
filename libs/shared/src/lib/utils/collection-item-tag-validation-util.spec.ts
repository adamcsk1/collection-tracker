import {
  COMPLETED_TAG,
  FAVORITE_TAG,
  INTERNAL_USED_TAGS,
  MOVIE_TAG,
  SERIES_TAG,
  VIRTUAL_TAGS,
  VIRTUAL_UNCOMPLETED_TAG,
  VIRTUAL_UNWATCHED_TAG,
  WATCH_LATER_TAG,
  WISHLIST_TAG,
} from '../constants/tags-const';
import {
  changeCollectionItemTagValidation,
  collectionItemTagValidation,
  createCollectionItemTagValidation,
  filterDisplayTags,
  filterEditableTags,
  filterEditorPreservedTags,
  forbiddenInternalTagTextValidation,
  invalidInternalCollectionTagValidation,
  typeTagValidation,
  userActionTagValidation,
  virtualTagValidation,
} from './collection-item-tag-validation-util';

const CUSTOM_WATCHED_TAG = '#watched';

describe('collection item tag validation util', () => {
  describe('forbiddenInternalTagTextValidation', () => {
    it('returns an error when a virtual tag is used', () => {
      expect(forbiddenInternalTagTextValidation(`${VIRTUAL_TAGS[0]} #action`)).toEqual({ kind: 'usedInternalTag' });
    });

    it('returns an error when internal tags are used', () => {
      expect(forbiddenInternalTagTextValidation(`start ${INTERNAL_USED_TAGS[0]}`)).toEqual({
        kind: 'usedInternalTag',
      });
      expect(forbiddenInternalTagTextValidation(`${INTERNAL_USED_TAGS[1]}`)).toEqual({ kind: 'usedInternalTag' });
    });

    it('matches whole tags instead of substrings', () => {
      expect(forbiddenInternalTagTextValidation('#movie-night #wishlist-custom #unwatched-list')).toBeUndefined();
    });

    it('returns no error for regular tag strings or null input', () => {
      expect(forbiddenInternalTagTextValidation('#custom #tag')).toBeUndefined();
      expect(forbiddenInternalTagTextValidation(null)).toBeUndefined();
    });
  });

  it('validates virtual tags', () => {
    expect(virtualTagValidation([MOVIE_TAG, VIRTUAL_UNWATCHED_TAG])).toEqual({ kind: 'virtualTag' });
    expect(virtualTagValidation([SERIES_TAG, VIRTUAL_UNCOMPLETED_TAG])).toEqual({ kind: 'virtualTag' });
    expect(virtualTagValidation([MOVIE_TAG, '#unwatched-list'])).toBeUndefined();
  });

  it('validates internal collection tags', () => {
    expect(invalidInternalCollectionTagValidation([MOVIE_TAG, WATCH_LATER_TAG])).toEqual({
      kind: 'invalidInternalCollectionTag',
    });
    expect(invalidInternalCollectionTagValidation([MOVIE_TAG, WISHLIST_TAG])).toEqual({
      kind: 'invalidInternalCollectionTag',
    });
    expect(invalidInternalCollectionTagValidation([MOVIE_TAG, '#watch-later-list'])).toBeUndefined();
  });

  it('validates user action tags', () => {
    expect(userActionTagValidation([MOVIE_TAG, FAVORITE_TAG])).toEqual({ kind: 'usedInternalTag' });
    expect(userActionTagValidation([MOVIE_TAG, CUSTOM_WATCHED_TAG])).toBeUndefined();
  });

  it('requires a type tag', () => {
    expect(typeTagValidation(['#action'])).toEqual({ kind: 'missingTypeTag' });
    expect(typeTagValidation([MOVIE_TAG])).toBeUndefined();
    expect(typeTagValidation([SERIES_TAG])).toBeUndefined();
  });

  it('validates base collection item tags', () => {
    expect(collectionItemTagValidation([MOVIE_TAG, VIRTUAL_UNWATCHED_TAG])).toEqual({ kind: 'virtualTag' });
    expect(collectionItemTagValidation([MOVIE_TAG, WATCH_LATER_TAG])).toEqual({
      kind: 'invalidInternalCollectionTag',
    });
    expect(collectionItemTagValidation([SERIES_TAG, COMPLETED_TAG])).toEqual({ kind: 'usedInternalTag' });
    expect(collectionItemTagValidation(['#action'])).toEqual({ kind: 'missingTypeTag' });
    expect(collectionItemTagValidation([MOVIE_TAG, '#action'])).toBeUndefined();
  });

  it('validates create item tags and list constraints', () => {
    expect(createCollectionItemTagValidation({ tags: [MOVIE_TAG, '#action'], listType: 'library' })).toBeUndefined();
    expect(createCollectionItemTagValidation({ tags: ['#action'], listType: 'library' })).toEqual({
      kind: 'missingTypeTag',
    });
    expect(createCollectionItemTagValidation({ tags: [MOVIE_TAG, FAVORITE_TAG], listType: 'watch-later' })).toEqual({
      kind: 'invalidNonLibraryTag',
    });
    expect(
      createCollectionItemTagValidation({
        tags: [MOVIE_TAG],
        listType: 'watch-later',
        targetOwnerShareCode: 'shared-code',
      })
    ).toEqual({ kind: 'invalidSharedListCreate' });
    expect(createCollectionItemTagValidation({ tags: [MOVIE_TAG], listType: 'series-tracker' })).toEqual({
      kind: 'invalidSeriesTrackerTags',
    });
    expect(createCollectionItemTagValidation({ tags: [SERIES_TAG], listType: 'series-tracker' })).toBeUndefined();
  });

  it('validates change item tags and list constraints', () => {
    expect(
      changeCollectionItemTagValidation({
        tags: [MOVIE_TAG, '#action'],
        listType: 'library',
        existingListType: 'library',
        requesterIsOwner: true,
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        tags: [MOVIE_TAG, VIRTUAL_UNWATCHED_TAG],
        listType: 'library',
        existingListType: 'library',
        requesterIsOwner: true,
      })
    ).toEqual({ kind: 'virtualTag' });
    expect(
      changeCollectionItemTagValidation({
        tags: [SERIES_TAG],
        listType: 'series-tracker',
        existingListType: 'series-tracker',
        requesterIsOwner: true,
      })
    ).toBeUndefined();
    expect(
      changeCollectionItemTagValidation({
        tags: [SERIES_TAG, FAVORITE_TAG],
        listType: 'series-tracker',
        existingListType: 'series-tracker',
        requesterIsOwner: true,
      })
    ).toEqual({ kind: 'invalidSeriesTrackerTags' });
    expect(
      changeCollectionItemTagValidation({
        tags: [MOVIE_TAG],
        listType: 'library',
        existingListType: 'watch-later',
        requesterIsOwner: true,
      })
    ).toEqual({ kind: 'invalidInternalCollectionItemUpdate' });
    expect(
      changeCollectionItemTagValidation({
        tags: [MOVIE_TAG],
        listType: 'watch-later',
        existingListType: 'watch-later',
        requesterIsOwner: false,
      })
    ).toEqual({ kind: 'sharedInternalCollectionItemUpdate' });
  });

  it('rejects episode progress tags in validation', () => {
    expect(
      createCollectionItemTagValidation({
        tags: [SERIES_TAG, '#episode-s01e02'],
        listType: 'series-tracker',
      })
    ).toEqual({ kind: 'invalidSeriesTrackerTags' });
    expect(
      changeCollectionItemTagValidation({
        tags: [SERIES_TAG, '#episode-s01e02'],
        listType: 'series-tracker',
        existingListType: 'series-tracker',
        requesterIsOwner: true,
      })
    ).toEqual({ kind: 'invalidSeriesTrackerTags' });
  });

  it('filters tags that should not be edited directly', () => {
    expect(
      filterEditableTags([
        MOVIE_TAG,
        CUSTOM_WATCHED_TAG,
        FAVORITE_TAG,
        COMPLETED_TAG,
        WATCH_LATER_TAG,
        WISHLIST_TAG,
        '#action',
      ])
    ).toEqual([MOVIE_TAG, CUSTOM_WATCHED_TAG, '#action']);
  });

  it('finds hidden tags that should be preserved in edit saves', () => {
    expect(
      filterEditorPreservedTags([
        MOVIE_TAG,
        CUSTOM_WATCHED_TAG,
        FAVORITE_TAG,
        COMPLETED_TAG,
        WATCH_LATER_TAG,
        WISHLIST_TAG,
        '#action',
      ])
    ).toEqual([FAVORITE_TAG, WATCH_LATER_TAG, WISHLIST_TAG]);
  });

  it('filters only list placement tags from display tags', () => {
    expect(
      filterDisplayTags([
        MOVIE_TAG,
        CUSTOM_WATCHED_TAG,
        FAVORITE_TAG,
        COMPLETED_TAG,
        WATCH_LATER_TAG,
        WISHLIST_TAG,
        '#action',
      ])
    ).toEqual([MOVIE_TAG, CUSTOM_WATCHED_TAG, FAVORITE_TAG, COMPLETED_TAG, '#action']);
  });
});
