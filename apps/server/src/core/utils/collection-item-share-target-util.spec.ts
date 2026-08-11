import { describe, expect, it } from 'vitest';
import { getDatabase } from '../database/database';
import { findOwnedCollectionItemShareTarget } from './collection-item-share-target-util';

const insertUser = (usernameHash: string): void => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertItem = (
  ownerHash: string,
  externalProvider: string,
  externalItemId: string,
  canonicalItemId: string,
  listType: 'library' | 'tracking' | 'books' = 'library',
  contentType: 'movie' | 'book' = 'movie'
): void => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
         title, title_lower, year, contributors, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', '', '', ?)`
    )
    .run(
      ownerHash,
      externalProvider,
      externalItemId,
      canonicalItemId,
      listType,
      contentType,
      `${ownerHash}-${listType}`,
      `${ownerHash}-${listType}`,
      `${ownerHash}-${listType}-${externalProvider}-${externalItemId}`
    );
};

const insertIdentity = (
  ownerHash: string,
  canonicalItemId: string,
  externalProvider: string,
  externalItemId: string
): void => {
  getDatabase()
    .prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, 'alias')`
    )
    .run(ownerHash, canonicalItemId, externalProvider, externalItemId);
};

describe('findOwnedCollectionItemShareTarget', () => {
  it('finds an item through its canonical identity mapping', () => {
    insertUser('owner');
    insertItem('owner', 'omdb', 'primary-id', 'imdb:tt0133093');
    insertIdentity('owner', 'imdb:tt0133093', 'omdb', 'alias-id');

    const item = findOwnedCollectionItemShareTarget('owner', 'omdb', 'alias-id', undefined);

    expect(item).toEqual(
      expect.objectContaining({ external_item_id: 'primary-id', canonical_item_id: 'imdb:tt0133093' })
    );
  });

  it('falls back to the exact external identity when the canonical mapping does not resolve an item', () => {
    insertUser('owner');
    insertItem('owner', 'omdb', 'legacy-id', 'omdb:legacy-row');
    insertIdentity('owner', 'omdb:missing-row', 'omdb', 'legacy-id');

    const item = findOwnedCollectionItemShareTarget('owner', 'omdb', 'legacy-id', undefined);

    expect(item).toEqual(
      expect.objectContaining({ external_item_id: 'legacy-id', canonical_item_id: 'omdb:legacy-row' })
    );
  });

  it('does not find an item owned by another user', () => {
    insertUser('owner');
    insertUser('other-owner');
    insertItem('other-owner', 'imdb', 'tt0133093', 'imdb:tt0133093');

    expect(findOwnedCollectionItemShareTarget('owner', 'imdb', 'tt0133093', undefined)).toBeUndefined();
  });

  it('defaults to the library list', () => {
    insertUser('owner');
    insertItem('owner', 'imdb', 'tt0133093', 'imdb:tt0133093');
    insertItem('owner', 'imdb', 'tt0133093', 'imdb:tt0133093', 'tracking');

    const item = findOwnedCollectionItemShareTarget('owner', 'imdb', 'tt0133093', undefined);

    expect(item?.list_type).toBe('library');
  });

  it('finds a book in an explicit books list scope', () => {
    insertUser('owner');
    insertItem('owner', 'openlibrary', '9780306406157', 'isbn:9780306406157');
    insertItem('owner', 'openlibrary', '9780306406157', 'isbn:9780306406157', 'books', 'book');

    const item = findOwnedCollectionItemShareTarget('owner', 'openlibrary', '9780306406157', 'books');

    expect(item).toEqual(expect.objectContaining({ list_type: 'books', content_type: 'book' }));
  });
});
