import { describe, expect, it } from 'vitest';
import { extractIsbn13, normalizeIsbn13 } from './isbn-util';

describe('normalizeIsbn13', () => {
  it.each([
    ['9780306406157', '9780306406157'],
    ['978-0-306-40615-7', '9780306406157'],
    ['ISBN 0-306-40615-2', '9780306406157'],
    ['0-8044-2957-X', '9780804429573'],
    ['isbn-10: 080442957X', '9780804429573'],
  ])('normalizes %s to ISBN-13', (value, expected) => {
    expect(normalizeIsbn13(value)).toBe(expected);
  });

  it.each(['', '9780306406158', '0306406153', '978-0-306-40A15-7', '123456789'])('rejects invalid ISBN %s', (value) => {
    expect(normalizeIsbn13(value)).toBeNull();
  });
});

describe('extractIsbn13', () => {
  it.each([
    ['https://openlibrary.org/isbn/9780306406157', '9780306406157'],
    ['https://openlibrary.org/isbn/9780306406157.json', '9780306406157'],
    ['see ISBN 0-306-40615-2 in catalog', '9780306406157'],
    ['978-0-306-40615-7', '9780306406157'],
  ])('extracts ISBN from %s', (value, expected) => {
    expect(extractIsbn13(value)).toBe(expected);
  });

  it.each(['The Matrix', '9780306406158', '97803064061571234'])('returns null when no valid ISBN in %s', (value) => {
    expect(extractIsbn13(value)).toBeNull();
  });
});
