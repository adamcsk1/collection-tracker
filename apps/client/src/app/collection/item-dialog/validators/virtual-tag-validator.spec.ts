import { virtualTagValidation } from './virtual-tag-validator';

describe('virtualTagValidation', () => {
  it('returns an error when virtual tag is used', () => {
    expect(virtualTagValidation('#unwatched')).toEqual({ kind: 'usedVirtualTag' });
  });

  it('returns no error for normal content', () => {
    expect(virtualTagValidation('normal content')).toBeUndefined();
  });

  it('returns no error for null input', () => {
    expect(virtualTagValidation(null)).toBeUndefined();
  });
});
