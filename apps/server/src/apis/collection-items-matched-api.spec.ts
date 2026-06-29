import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUserAndItems = () => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  db.prepare(
    `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'tt001', 'Alpha', 'alpha', '1999', '8.0', 'Plot one', 'img1.jpg', 'hash1');
  db.prepare(
    `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'tt002', 'Beta', 'beta', '2000', '7.5', 'Plot two', 'img2.jpg', 'hash2');
};

describe('collection-items-matched-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns matched items ordered by identities', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        identities: [
          { source: 'imdb', id: 'tt002' },
          { source: 'imdb', id: 'tt001' },
        ],
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ title: 'Beta' }),
          expect.objectContaining({ title: 'Alpha' }),
        ]),
        total: 2,
      })
    );
  });

  it('matches items by resolved canonical identities', async () => {
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, title, title_lower, year, rate, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'user',
      null,
      'omdb',
      'provider-item-id',
      'imdb:tt001',
      'Canonical Item',
      'canonical item',
      '2001',
      '8.0',
      '',
      '',
      'hash'
    );
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'imdb:tt001', 'imdb', 'tt001', 'provider');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: { identities: [{ source: 'imdb', id: 'tt001' }] },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ title: 'Canonical Item' })],
        total: 1,
      })
    );
  });

  it('returns 400 when identities are missing', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when identities contain invalid values', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { identities: [{ source: 'imdb', id: 'tt001' }, 42] } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns empty when no identities match', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { identities: [] } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ items: [], total: 0 }));
  });
});
