import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as collectionItemUtil from '@client/collection/utils/get-collection-item-util';
import { rawContentValidation } from './raw-content-validator';

const validParsedItem = (): any => ({
  rawContent: '### My Movie',
  rawContentLower: '### my movie',
  image: 'https://image.example/poster.jpg',
  title: 'My Movie',
  titleLower: 'my movie',
  genre: ['Action'],
  tags: ['#movie'],
  IMDbId: 'tt123',
  year: 2021,
  rate: '8.7',
  name: 'My Movie',
});

describe('rawContentValidation', () => {
  let getCollectionItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getCollectionItemSpy = vi.spyOn(collectionItemUtil, 'getCollectionItem').mockReturnValue(validParsedItem());
  });

  afterEach(() => {
    getCollectionItemSpy.mockRestore();
  });

  it('passes when parsed content has all required fields', () => {
    expect(rawContentValidation('### My Movie #movie')).toBeUndefined();
  });

  it('passes when content is null', () => {
    expect(rawContentValidation(null)).toBeUndefined();
  });

  it('returns badRawContent when a parsed field is empty', () => {
    getCollectionItemSpy.mockReturnValueOnce({
      ...validParsedItem(),
      title: '',
    });

    expect(rawContentValidation('### My Movie #movie')).toEqual({ kind: 'badRawContent' });
  });

  it('returns badRawContent when parsed tags are empty', () => {
    getCollectionItemSpy.mockReturnValueOnce({
      ...validParsedItem(),
      tags: [],
    });

    expect(rawContentValidation('### My Movie #movie')).toEqual({ kind: 'badRawContent' });
  });
});
