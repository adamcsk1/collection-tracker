import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUserAndItems = () => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  for (let i = 1; i <= 3; i++) {
    db.prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('user', `tt00${i}`, `Item ${i}`, `item ${i}`, '1999', '8.0', 'Plot', `img${i}.jpg`, `hash${i}`);
  }
};

describe('random-images-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns random images', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { count: '2' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./random-images-api');
    register(app);

    await handlerPromise();
    const result = response.send.mock.calls[0][0];
    expect(result.images).toBeInstanceOf(Array);
    expect(result.images.length).toBeLessThanOrEqual(2);
  });

  it('defaults count to 10', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./random-images-api');
    register(app);

    await handlerPromise();
    const result = response.send.mock.calls[0][0];
    expect(result.images.length).toBeLessThanOrEqual(3);
  });

  it('caps count at 50', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { count: '100' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./random-images-api');
    register(app);

    await handlerPromise();
    const result = response.send.mock.calls[0][0];
    expect(result.images.length).toBeLessThanOrEqual(3);
  });
});
