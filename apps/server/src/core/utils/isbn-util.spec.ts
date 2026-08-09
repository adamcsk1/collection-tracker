import { describe, expect, it } from 'vitest';
import { extractIsbn13, normalizeIsbn13 } from './isbn-util';

describe('isbn-util re-export', () => {
  it('re-exports normalizeIsbn13', () => {
    expect(normalizeIsbn13('978-0-306-40615-7')).toBe('9780306406157');
  });

  it('re-exports extractIsbn13', () => {
    expect(extractIsbn13('https://openlibrary.org/isbn/9780306406157')).toBe('9780306406157');
  });
});
