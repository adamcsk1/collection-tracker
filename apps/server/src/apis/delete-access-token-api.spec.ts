import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');

describe('delete-access-token-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deletes matching access token', async () => {
    const response = mockResponse();
    const request: any = { params: { tokenHash: 'remove' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockReturnValue({
      user: { accessTokens: [{ tokenHash: 'keep' }, { tokenHash: 'remove' }] },
    });
    const setSpy = vi.spyOn(Store, 'set');

    await import('./delete-access-token-api');

    await handlerPromise();
    expect(setSpy).toHaveBeenCalledWith('users', { user: { accessTokens: [{ tokenHash: 'keep' }] } });
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { params: { tokenHash: 'remove' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    await import('./delete-access-token-api');

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
