import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');

describe('access-tokens-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns access tokens for user', async () => {
    const request: any = { usernameHash: 'user' };
    const response = mockResponse();
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockReturnValue({
      user: { accessTokens: [{ tokenHash: 'abc' }] },
    });

    await import('./access-tokens-api');

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith([{ tokenHash: 'abc' }]);
  });

  it('returns 500 on unexpected error', async () => {
    const request: any = { usernameHash: 'user' };
    const response = mockResponse();
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('boom');
    });

    await import('./access-tokens-api');

    await handlerPromise();

    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
