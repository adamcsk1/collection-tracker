import type { UserShareGrantApiModel } from '@shared/models/api-model';
import { getDatabase } from '../database/database';
import { replaceCollectionItemSelections, upsertShare } from '../database/repositories/share-repository';
import type { CollectionItemRow } from '../database/repositories/collection/collection-model';
import { getUserShareCode } from '../database/repositories/user-repository';
import { describe, expect, it } from 'vitest';
import { resolveTrackingSeriesTarget } from './tracking-series-target-util';

const insertUser = (usernameHash: string): void => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertItem = (ownerHash: string, listType = 'tracking', contentType = 'series'): void => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
         title, title_lower, year, description, image, content_hash)
       VALUES (?, 'imdb', 'tt-series', 'imdb:tt-series', ?, ?, 'Series', 'series', '', '', '', ?)`
    )
    .run(ownerHash, listType, contentType, `${ownerHash}-${listType}-${contentType}`);
};

const grant = (canRead: boolean, canUpdate: boolean): UserShareGrantApiModel => ({
  listType: 'tracking',
  contentType: 'series',
  canRead,
  canCreate: false,
  canUpdate,
  canDelete: false,
  readMode: 'all',
});

describe('resolveTrackingSeriesTarget', () => {
  it.each(['read', 'update'] as const)('resolves own series for %s access', (permission) => {
    insertUser('owner');
    insertItem('owner');

    const result = resolveTrackingSeriesTarget(getDatabase(), 'owner', undefined, 'imdb', 'tt-series', permission);

    expect(result).toEqual({ status: 200, ownerHash: 'owner', item: expect.objectContaining({ title: 'Series' }) });
  });

  it.each([
    ['read', true, false],
    ['update', true, true],
  ] as const)('resolves shared series for %s access', (permission, canRead, canUpdate) => {
    insertUser('owner');
    insertUser('viewer');
    insertItem('owner');
    upsertShare(getDatabase(), 'owner', 'viewer', [grant(canRead, canUpdate)]);

    const result = resolveTrackingSeriesTarget(
      getDatabase(),
      'viewer',
      getUserShareCode('owner'),
      'imdb',
      'tt-series',
      permission
    );

    expect(result).toEqual({ status: 200, ownerHash: 'owner', item: expect.objectContaining({ title: 'Series' }) });
  });

  it('returns 403 when requested permission is denied', () => {
    insertUser('owner');
    insertUser('viewer');
    insertItem('owner');
    upsertShare(getDatabase(), 'owner', 'viewer', [grant(true, false)]);

    expect(
      resolveTrackingSeriesTarget(getDatabase(), 'viewer', getUserShareCode('owner'), 'imdb', 'tt-series', 'update')
    ).toEqual({ status: 403 });
  });

  it('allows a selected tracking series and denies an unselected sibling', () => {
    insertUser('owner');
    insertUser('viewer');
    insertItem('owner');
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
         (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
          title, title_lower, year, description, image, content_hash)
         VALUES ('owner', 'imdb', 'tt-hidden', 'imdb:tt-hidden', 'tracking', 'series',
                 'Hidden', 'hidden', '', '', '', 'hidden')`
      )
      .run();
    upsertShare(getDatabase(), 'owner', 'viewer', []);
    const selectedItem = getDatabase()
      .prepare("SELECT * FROM collection_items WHERE external_item_id = 'tt-series'")
      .get() as CollectionItemRow;
    replaceCollectionItemSelections(getDatabase(), 'owner', selectedItem, [
      {
        sharedWithUsernameHash: 'viewer',
        permissions: { canRead: true, canCreate: false, canUpdate: true, canDelete: false },
      },
    ]);

    expect(
      resolveTrackingSeriesTarget(getDatabase(), 'viewer', getUserShareCode('owner'), 'imdb', 'tt-series', 'update')
    ).toEqual({ status: 200, ownerHash: 'owner', item: expect.objectContaining({ external_item_id: 'tt-series' }) });
    expect(
      resolveTrackingSeriesTarget(getDatabase(), 'viewer', getUserShareCode('owner'), 'imdb', 'tt-hidden', 'update')
    ).toEqual({ status: 403 });
  });

  it('returns 404 when owner share code does not resolve', () => {
    insertUser('viewer');

    expect(resolveTrackingSeriesTarget(getDatabase(), 'viewer', 'missing', 'imdb', 'tt-series', 'read')).toEqual({
      status: 404,
    });
  });

  it('returns 404 when item does not exist', () => {
    insertUser('owner');

    expect(resolveTrackingSeriesTarget(getDatabase(), 'owner', undefined, 'imdb', 'missing', 'read')).toEqual({
      status: 404,
    });
  });

  it.each([
    ['library', 'series'],
    ['tracking', 'movie'],
  ])('returns 404 for %s/%s item', (listType, contentType) => {
    insertUser('owner');
    insertItem('owner', listType, contentType);

    expect(resolveTrackingSeriesTarget(getDatabase(), 'owner', undefined, 'imdb', 'tt-series', 'read')).toEqual({
      status: 404,
    });
  });
});
