import { describe, expect, it } from 'vitest';
import {
  contentTypeAllowedOnList,
  defaultLibraryReadGrants,
  hasSharePermission,
  isValidShareScope,
  normalizeShareGrants,
  SHAREABLE_SCOPES,
} from './share-grant-util';

describe('share-grant-util', () => {
  it('lists only valid share scopes', () => {
    expect(SHAREABLE_SCOPES).toContainEqual({ listType: 'library', contentType: 'movie' });
    expect(SHAREABLE_SCOPES).toContainEqual({ listType: 'books', contentType: 'book' });
    expect(SHAREABLE_SCOPES).not.toContainEqual({ listType: 'library', contentType: 'book' });
    expect(SHAREABLE_SCOPES).not.toContainEqual({ listType: 'books', contentType: 'movie' });
  });

  it('validates content types per list', () => {
    expect(contentTypeAllowedOnList('library', 'movie')).toBe(true);
    expect(contentTypeAllowedOnList('library', 'book')).toBe(false);
    expect(contentTypeAllowedOnList('tracking', 'book')).toBe(true);
    expect(isValidShareScope('wishlist', 'series')).toBe(true);
    expect(isValidShareScope('library', 'book')).toBe(false);
  });

  it('normalizes grants and forces read when write is set', () => {
    expect(
      normalizeShareGrants([
        {
          listType: 'library',
          contentType: 'movie',
          canRead: false,
          canCreate: true,
          canUpdate: false,
          canDelete: false,
        },
        {
          listType: 'library',
          contentType: 'book',
          canRead: true,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
        },
        {
          listType: 'library',
          contentType: 'movie',
          canRead: true,
          canCreate: false,
          canUpdate: true,
          canDelete: false,
        },
      ])
    ).toEqual([
      {
        listType: 'library',
        contentType: 'movie',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: false,
      },
    ]);
  });

  it('checks permission on matching grant', () => {
    const grants = defaultLibraryReadGrants();
    expect(hasSharePermission(grants, 'library', 'movie', 'read')).toBe(true);
    expect(hasSharePermission(grants, 'library', 'movie', 'create')).toBe(false);
    expect(hasSharePermission(grants, 'wishlist', 'movie', 'read')).toBe(false);
  });
});
