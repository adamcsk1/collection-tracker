import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn(async () => 'hashed-token'),
}));

describe('logout-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('clears cookie and returns 204', async () => {
    const response = mockResponse();
    const request: any = { signedCookies: { CT: 'token' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockReturnValue({ user: { accessTokens: [{ tokenHash: 'hashed-token' }] } });
    (Store.set as Mock).mockImplementation(() => undefined);

    await import('./logout-api');

    await handlerPromise();

    expect(response.clearCookie).toHaveBeenCalled();
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { signedCookies: { CT: 'token' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    await import('./logout-api');

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
