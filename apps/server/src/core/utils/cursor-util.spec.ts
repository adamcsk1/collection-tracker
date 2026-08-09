import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { createCollectionFilterHash, CursorValidationError, decodeCursor, encodeCursor } from './cursor-util';

const encodeRawCursor = (payload: Record<string, unknown>, secret: string): string => {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
};

describe('cursor-util', () => {
  const secret = 'cursor-test-secret';
  const filterHash = createCollectionFilterHash('user', {
    listType: 'library',
    search: ' Space ',
    tags: ['Drama', 'Favorite'],
    orderBy: 'alphabet',
    orderDirection: 'asc',
  });

  it('round-trips signed collection and matched cursors', () => {
    const collectionCursor = encodeCursor(
      { version: 1, kind: 'collection', sortValue: 'alpha', rowId: 42, filterHash },
      secret
    );
    const matchesCursor = encodeCursor({ version: 1, kind: 'matches', rank: 50, rowId: 75, filterHash }, secret);

    expect(decodeCursor(collectionCursor, 'collection', filterHash, secret)).toEqual({
      version: 1,
      kind: 'collection',
      sortValue: 'alpha',
      rowId: 42,
      filterHash,
    });
    expect(decodeCursor(matchesCursor, 'matches', filterHash, secret)).toEqual({
      version: 1,
      kind: 'matches',
      rank: 50,
      rowId: 75,
      filterHash,
    });
  });

  it.each([
    ['malformed', 'not-a-cursor'],
    [
      'tampered',
      `${encodeCursor({ version: 1, kind: 'collection', sortValue: 'alpha', rowId: 42, filterHash }, secret)}x`,
    ],
  ])('rejects %s cursors', (_description, cursor) => {
    expect(() => decodeCursor(cursor, 'collection', filterHash, secret)).toThrow(CursorValidationError);
  });

  it('rejects wrong-kind and filter-mismatched cursors', () => {
    const cursor = encodeCursor({ version: 1, kind: 'collection', sortValue: 'alpha', rowId: 42, filterHash }, secret);

    expect(() => decodeCursor(cursor, 'matches', filterHash, secret)).toThrow(CursorValidationError);
    expect(() => decodeCursor(cursor, 'collection', 'different-filter', secret)).toThrow(CursorValidationError);
  });

  it.each([
    { rank: -1, rowId: 1 },
    { rank: 1.5, rowId: 1 },
    { rank: 1, rowId: 0 },
    { rank: 1, rowId: 1.5 },
  ])('rejects malformed matched cursor fields: %j', ({ rank, rowId }) => {
    const cursor = encodeCursor({ version: 1, kind: 'matches', rank, rowId, filterHash }, secret);

    expect(() => decodeCursor(cursor, 'matches', filterHash, secret)).toThrow(CursorValidationError);
  });

  it.each([
    { sortValue: null, rowId: 1 },
    { sortValue: 'alpha', rowId: 0 },
    { sortValue: 'alpha', rowId: 1.5 },
  ])('rejects malformed collection cursor fields: %j', ({ sortValue, rowId }) => {
    const cursor = encodeRawCursor({ version: 1, kind: 'collection', sortValue, rowId, filterHash }, secret);

    expect(() => decodeCursor(cursor, 'collection', filterHash, secret)).toThrow(CursorValidationError);
  });

  it('rejects oversized cursors before decoding', () => {
    expect(() => decodeCursor('x'.repeat(4097), 'collection', filterHash, secret)).toThrow(CursorValidationError);
  });

  it('normalizes equivalent filter values before hashing', () => {
    const equivalentHash = createCollectionFilterHash('user', {
      listType: 'library',
      search: 'space',
      tags: ['favorite', 'drama'],
      orderBy: 'alphabet',
      orderDirection: 'asc',
    });

    expect(equivalentHash).toBe(filterHash);
  });

  it('binds filter hashes to viewer and matched identity order', () => {
    const identities = [
      { source: 'imdb' as const, id: 'tt001' },
      { source: 'omdb' as const, id: '2' },
    ];
    const matchedHash = createCollectionFilterHash('user', undefined, identities);

    expect(createCollectionFilterHash('other-user', undefined, identities)).not.toBe(matchedHash);
    expect(createCollectionFilterHash('user', undefined, [...identities].reverse())).not.toBe(matchedHash);
  });
});
