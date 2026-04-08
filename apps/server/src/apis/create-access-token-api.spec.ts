import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { Store } from '../core/store/store';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/jwt', () => ({
  generateAccessToken: vi.fn().mockReturnValue('access'),
  jwtGuard: vi.fn((_request: any, _response: any, next: any) => next()),
}));
vi.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: vi.fn(() => ({ tokenHash: 'hashed-access' })),
}));

describe('create-access-token-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('creates a new access token and stores it', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({ user: { accessTokens: [] } });
    (Store.set as Mock).mockImplementation(() => undefined);
    const setSpy = vi.spyOn(Store, 'set');

    const { register } = await import('./create-access-token-api');
    register(app);

    await handlerPromise();

    expect(setSpy).toHaveBeenCalledWith('users', { user: { accessTokens: [{ tokenHash: 'hashed-access' }] } });
    expect(response.send).toHaveBeenCalledWith({ accessToken: 'access' });
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./create-access-token-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
