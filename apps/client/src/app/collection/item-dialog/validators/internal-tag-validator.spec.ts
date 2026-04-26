import { MOVIE_TAG, SERIES_TAG } from '@shared/constants/tags-const';
import { missingInternalTagValidation } from './internal-tag-validator';

describe('missingInternalTagValidation', () => {
  it('returns an error when no internal tag is present', () => {
    expect(missingInternalTagValidation('just regular tags')).toEqual({ kind: 'unusedInternalTag' });
  });

  it('passes when movie tag is present', () => {
    expect(missingInternalTagValidation(`content with ${MOVIE_TAG}`)).toBeUndefined();
  });

  it('passes when series tag is present', () => {
    expect(missingInternalTagValidation(`content with ${SERIES_TAG}`)).toBeUndefined();
  });

  it('returns no error for null input', () => {
    expect(missingInternalTagValidation(null)).toEqual({ kind: 'unusedInternalTag' });
  });
});
