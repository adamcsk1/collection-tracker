import { filenamePatternValidationError } from './filename-pattern-validator';
import { describe, expect, it } from 'vitest';

describe('filename-pattern-validator', () => {
  it('returns filenamePattern when pattern does not end with .md', () => {
    expect(filenamePatternValidationError('file-name')).toEqual({
      kind: 'filenamePattern',
    });
  });

  it('returns undefined for valid patterns', () => {
    expect(filenamePatternValidationError('{{Year}}-{{Title}}.md')).toBeUndefined();
  });

  it('treats uppercase .MD extension as valid', () => {
    expect(filenamePatternValidationError('{{Year}}-{{Title}}.MD')).toBeUndefined();
  });
});
