import { buildApp } from '@server-mocks/build-app-mock';
import { mockResponse } from '@server-mocks/response-mock';
import { Store } from '@server/core/store/store';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@server/core/store/store');

describe('delete-access-token-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deletes matching access token', async () => {
    const response = mockResponse();
    const request: any = { params: { tokenHash: 'remove' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({
      user: { accessTokens: [{ tokenHash: 'keep' }, { tokenHash: 'remove' }] },
    });
    const setSpy = vi.spyOn(Store, 'set');

    const { register } = await import('./delete-access-token-api');
    register(app);

    await handlerPromise();
    expect(setSpy).toHaveBeenCalledWith('users', { user: { accessTokens: [{ tokenHash: 'keep' }] } });
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { params: { tokenHash: 'remove' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./delete-access-token-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
