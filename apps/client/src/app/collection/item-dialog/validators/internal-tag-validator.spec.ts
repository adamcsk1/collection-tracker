import { MOVIE_TAG, SERIES_TAG } from '@shared/constants/tags-const';
import { internalTagValidation } from './internal-tag-validator';

describe('internalTagValidation', () => {
  it('returns an error when no internal tag is present', () => {
    expect(internalTagValidation('just regular tags')).toEqual({ kind: 'unusedInternalTag' });
  });

  it('passes when movie tag is present', () => {
    expect(internalTagValidation(`content with ${MOVIE_TAG}`)).toBeUndefined();
  });

  it('passes when series tag is present', () => {
    expect(internalTagValidation(`content with ${SERIES_TAG}`)).toBeUndefined();
  });

  it('returns no error for null input', () => {
    expect(internalTagValidation(null)).toEqual({ kind: 'unusedInternalTag' });
  });
});
