import {
  COMPLETED_TAG,
  FAVORITE_TAG,
  INTERNAL_USED_TAGS,
  MOVIE_TAG,
  SERIES_TAG,
  VIRTUAL_TAGS,
  VIRTUAL_UNWATCHED_TAG,
  WATCHED_TAG,
  WATCH_LATER_TAG,
  WISHLIST_TAG,
} from '@shared/constants/tags-const';
import {
  filterEditableTags,
  filterDisplayTags,
  filterEditorPreservedTags,
  forbiddenInternalTagValidation,
  invalidInternalCollectionTagValidation,
  serverManagedTagValidation,
  typeTagValidation,
  userActionTagValidation,
  virtualTagValidation,
} from './tag-validators';

describe('tag validators', () => {
  describe('forbiddenInternalTagValidation', () => {
    it('returns an error when a virtual tag is used', () => {
      expect(forbiddenInternalTagValidation(`${VIRTUAL_TAGS[0]} #action`)).toEqual({ kind: 'usedInternalTag' });
    });

    it('returns an error when internal tags are used', () => {
      expect(forbiddenInternalTagValidation(`start ${INTERNAL_USED_TAGS[0]}`)).toEqual({ kind: 'usedInternalTag' });
      expect(forbiddenInternalTagValidation(`${INTERNAL_USED_TAGS[1]}`)).toEqual({ kind: 'usedInternalTag' });
    });

    it('matches whole tags instead of substrings', () => {
      expect(forbiddenInternalTagValidation('#movie-night #wishlist-custom #unwatched-list')).toBeUndefined();
    });

    it('returns no error for regular tag strings', () => {
      expect(forbiddenInternalTagValidation('#custom #tag')).toBeUndefined();
    });

    it('returns no error for null input', () => {
      expect(forbiddenInternalTagValidation(null)).toBeUndefined();
    });
  });

  it('validates virtual tags', () => {
    expect(virtualTagValidation([MOVIE_TAG, VIRTUAL_UNWATCHED_TAG])).toEqual({ kind: 'virtualTag' });
    expect(virtualTagValidation([MOVIE_TAG, '#unwatched-list'])).toBeUndefined();
  });

  it('validates server-managed tags', () => {
    expect(serverManagedTagValidation([SERIES_TAG, COMPLETED_TAG])).toEqual({ kind: 'usedInternalTag' });
    expect(serverManagedTagValidation([SERIES_TAG, '#custom'])).toBeUndefined();
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
    expect(userActionTagValidation([MOVIE_TAG, WATCHED_TAG])).toEqual({ kind: 'usedInternalTag' });
    expect(userActionTagValidation([MOVIE_TAG, FAVORITE_TAG])).toEqual({ kind: 'usedInternalTag' });
    expect(userActionTagValidation([MOVIE_TAG, '#custom'])).toBeUndefined();
  });

  it('requires a type tag', () => {
    expect(typeTagValidation(['#action'])).toEqual({ kind: 'missingTypeTag' });
    expect(typeTagValidation([MOVIE_TAG])).toBeUndefined();
    expect(typeTagValidation([SERIES_TAG])).toBeUndefined();
  });

  it('filters tags that should not be edited directly', () => {
    expect(
      filterEditableTags([
        MOVIE_TAG,
        WATCHED_TAG,
        FAVORITE_TAG,
        COMPLETED_TAG,
        WATCH_LATER_TAG,
        WISHLIST_TAG,
        '#action',
      ])
    ).toEqual([MOVIE_TAG, '#action']);
  });

  it('finds hidden tags that should be preserved in edit saves', () => {
    expect(
      filterEditorPreservedTags([
        MOVIE_TAG,
        WATCHED_TAG,
        FAVORITE_TAG,
        COMPLETED_TAG,
        WATCH_LATER_TAG,
        WISHLIST_TAG,
        '#action',
      ])
    ).toEqual([WATCHED_TAG, FAVORITE_TAG, WATCH_LATER_TAG, WISHLIST_TAG]);
  });

  it('filters only list placement tags from display tags', () => {
    expect(
      filterDisplayTags([MOVIE_TAG, WATCHED_TAG, FAVORITE_TAG, COMPLETED_TAG, WATCH_LATER_TAG, WISHLIST_TAG, '#action'])
    ).toEqual([MOVIE_TAG, WATCHED_TAG, FAVORITE_TAG, COMPLETED_TAG, '#action']);
  });
});
