import {
  INTERNAL_USED_TAGS,
  MOVIE_TAG,
  SERIES_TAG,
  VIRTUAL_TAGS,
  VIRTUAL_UNWATCHED_TAG,
  WATCH_LATER_TAG,
  WISHLIST_TAG,
} from '@shared/constants/tags-const';
import {
  buildEpisodeProgressTag,
  filterEditableTags,
  forbiddenInternalTagValidation,
  invalidInternalCollectionTagValidation,
  parseEpisodeProgress,
  removeEpisodeProgressTags,
  typeTagValidation,
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

  it('validates internal collection tags', () => {
    expect(invalidInternalCollectionTagValidation([MOVIE_TAG, WATCH_LATER_TAG])).toEqual({
      kind: 'invalidInternalCollectionTag',
    });
    expect(invalidInternalCollectionTagValidation([MOVIE_TAG, WISHLIST_TAG])).toEqual({
      kind: 'invalidInternalCollectionTag',
    });
    expect(invalidInternalCollectionTagValidation([MOVIE_TAG, '#watch-later-list'])).toBeUndefined();
  });

  it('requires a type tag', () => {
    expect(typeTagValidation(['#action'])).toEqual({ kind: 'missingTypeTag' });
    expect(typeTagValidation([MOVIE_TAG])).toBeUndefined();
    expect(typeTagValidation([SERIES_TAG])).toBeUndefined();
  });

  it('builds and parses episode progress tags', () => {
    const tag = buildEpisodeProgressTag(3, 4);

    expect(tag).toBe('#episode-s03e04');
    expect(parseEpisodeProgress([MOVIE_TAG, tag])).toEqual({ season: 3, episode: 4 });
    expect(parseEpisodeProgress([MOVIE_TAG])).toBeNull();
  });

  it('filters tags that should not be edited directly', () => {
    expect(removeEpisodeProgressTags([MOVIE_TAG, '#episode-s01e02', '#action'])).toEqual([MOVIE_TAG, '#action']);
    expect(filterEditableTags([MOVIE_TAG, WATCH_LATER_TAG, WISHLIST_TAG, '#episode-s01e02', '#action'])).toEqual([
      MOVIE_TAG,
      '#action',
    ]);
  });
});
