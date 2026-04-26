import { INTERNAL_USED_TAGS, VIRTUAL_TAGS } from '@shared/constants/tags-const';
import { forbiddenInternalTagValidation } from './internal-tag-validator';

describe('forbiddenInternalTagValidation', () => {
  it('returns an error when a virtual tag is used', () => {
    expect(forbiddenInternalTagValidation(`${VIRTUAL_TAGS[0]} #action`)).toEqual({ kind: 'usedInternalTag' });
  });

  it('returns an error when internal tags are used', () => {
    expect(forbiddenInternalTagValidation(`start ${INTERNAL_USED_TAGS[0]}`)).toEqual({ kind: 'usedInternalTag' });
    expect(forbiddenInternalTagValidation(`${INTERNAL_USED_TAGS[1]}`)).toEqual({ kind: 'usedInternalTag' });
  });

  it('returns no error for regular tag strings', () => {
    expect(forbiddenInternalTagValidation('#custom #tag')).toBeUndefined();
  });

  it('returns no error for null input', () => {
    expect(forbiddenInternalTagValidation(null)).toBeUndefined();
  });
});
