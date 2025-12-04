import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';

jest.mock('@server/core/store/store');

describe('access-tokens-api', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns access tokens for user', async () => {
    const request: any = { usernameHash: 'user' };
    const response = mockResponse();
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue({
      user: { accessTokens: [{ tokenHash: 'abc' }] },
    });

    jest.isolateModules(() => {
      require('./access-tokens-api');
    });

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith([{ tokenHash: 'abc' }]);
  });

  it('returns 500 on unexpected error', async () => {
    const request: any = { usernameHash: 'user' };
    const response = mockResponse();
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockImplementation(() => {
      throw new Error('boom');
    });

    jest.isolateModules(() => {
      require('./access-tokens-api');
    });

    await handlerPromise();

    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
