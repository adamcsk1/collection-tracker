import { describe, expect, it } from 'vitest';
import { CollectionItemContentTypeModel } from '../models/collection-item-model';
import { normalizePhotoImportIdentifier } from './photo-import-identifier-util';

describe('normalizePhotoImportIdentifier', () => {
  it.each<[CollectionItemContentTypeModel, string, string]>([
    ['movie', 'TT0133093', 'tt0133093'],
    ['series', 'https://www.imdb.com/title/tt0944947/', 'tt0944947'],
    ['book', 'ISBN-10: 0-441-17271-7', '9780441172719'],
    ['book', '978-0-441-17271-9', '9780441172719'],
    ['album', ' 6D6E2B1B-5E60-4A85-8D69-E9D513EC2B00 ', '6d6e2b1b-5e60-4a85-8d69-e9d513ec2b00'],
    ['album', '0 12345 67890 5', '012345678905'],
    ['album', '4006381333931', '4006381333931'],
    ['album', '96385074', '96385074'],
    ['album', '10012345678902', '10012345678902'],
  ])('normalizes %s identifier %s', (contentType, value, expected) => {
    expect(normalizePhotoImportIdentifier(value, contentType)).toBe(expected);
  });

  it.each<[CollectionItemContentTypeModel, unknown]>([
    ['book', '9780441172718'],
    ['book', '4006381333931'],
    ['book', 'tt0133093'],
    ['movie', '9780441172719'],
    ['movie', 'tt123'],
    ['album', '012345678904'],
    ['album', '000000000000'],
    ['album', '123456789'],
    ['album', 'tt0133093'],
    ['book', null],
    ['book', 9780441172719],
    ['book', {}],
    ['movie', 'tt' + '1'.repeat(301)],
  ])('rejects invalid or wrong-media identifiers for %s: %j', (contentType, value) => {
    expect(normalizePhotoImportIdentifier(value, contentType)).toBeNull();
  });
});
