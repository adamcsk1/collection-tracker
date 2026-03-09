import { INTERNAL_USED_TAGS, VIRTUAL_TAGS } from '@shared/constants/tags-const';
import { internalTagValidation } from './internal-tag-validator';

describe('internalTagValidation', () => {
  it('returns an error when a virtual tag is used', () => {
    expect(internalTagValidation(`${VIRTUAL_TAGS[0]} #action`)).toEqual({ kind: 'usedInternalTag' });
  });

  it('returns an error when internal tags are used', () => {
    expect(internalTagValidation(`start ${INTERNAL_USED_TAGS[0]}`)).toEqual({ kind: 'usedInternalTag' });
    expect(internalTagValidation(`${INTERNAL_USED_TAGS[1]}`)).toEqual({ kind: 'usedInternalTag' });
  });

  it('returns no error for regular tag strings', () => {
    expect(internalTagValidation('#custom #tag')).toBeUndefined();
  });

  it('returns no error for null input', () => {
    expect(internalTagValidation(null)).toBeUndefined();
  });
});
