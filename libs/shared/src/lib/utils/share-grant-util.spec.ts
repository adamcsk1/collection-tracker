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

  it('rejects unknown scopes and non-string scope values', () => {
    expect(contentTypeAllowedOnList('archive', 'movie')).toBe(false);
    expect(contentTypeAllowedOnList('books', 'movie')).toBe(false);
    expect(contentTypeAllowedOnList('up-next', 'series')).toBe(true);
    expect(isValidShareScope(null, 'movie')).toBe(false);
    expect(isValidShareScope('library', null)).toBe(false);
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

  it('checks every write permission and rejects unsupported permissions', () => {
    const grants = [
      {
        listType: 'tracking' as const,
        contentType: 'series' as const,
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      },
    ];

    expect(hasSharePermission(grants, 'tracking', 'series', 'create')).toBe(true);
    expect(hasSharePermission(grants, 'tracking', 'series', 'update')).toBe(true);
    expect(hasSharePermission(grants, 'tracking', 'series', 'delete')).toBe(true);
  });

  it('drops empty grants and sorts normalized scopes', () => {
    expect(
      normalizeShareGrants([
        {
          listType: 'wishlist',
          contentType: 'series',
          canRead: false,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
        },
        {
          listType: 'tracking',
          contentType: 'series',
          canRead: true,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
        },
        {
          listType: 'books',
          contentType: 'book',
          canRead: false,
          canCreate: false,
          canUpdate: false,
          canDelete: true,
        },
      ])
    ).toEqual([
      expect.objectContaining({ listType: 'books', contentType: 'book', canRead: true, canDelete: true }),
      expect.objectContaining({ listType: 'tracking', contentType: 'series', canRead: true }),
    ]);
  });
});
