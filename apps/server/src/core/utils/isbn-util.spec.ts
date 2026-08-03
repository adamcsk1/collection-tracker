import { describe, expect, it } from 'vitest';
import { normalizeIsbn13 } from './isbn-util';

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

  it.each(['', '9780306406158', '0306406153', '978-0-306-40A15-7', '123456789', 'X780306406157'])(
    'rejects invalid ISBN %s',
    (value) => {
      expect(normalizeIsbn13(value)).toBeNull();
    }
  );
});
