import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { Store } from '../core/store/store';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn(() => 'hashed-token'),
}));

describe('logout-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('clears cookie and returns 204', async () => {
    const response = mockResponse();
    const request: any = { signedCookies: { 'CT.Token': 'token' }, headers: {}, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({ user: { accessTokens: [{ tokenHash: 'hashed-token' }] } });
    (Store.set as Mock).mockImplementation(() => undefined);

    const { register } = await import('./logout-api');
    register(app);

    await handlerPromise();

    expect(response.clearCookie).toHaveBeenCalled();
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { signedCookies: { 'CT.Token': 'token' }, headers: {}, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./logout-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
