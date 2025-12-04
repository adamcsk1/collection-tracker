import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';

jest.mock('@server/core/store/store');
jest.mock('@server/core/crypto', () => ({
  hashText: jest.fn(async () => 'hashed-token'),
}));

describe('logout-api', () => {
  afterEach(() => jest.clearAllMocks());

  it('clears cookie and returns 204', async () => {
    const response = mockResponse();
    const request: any = { signedCookies: { CT: 'token' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue({ user: { accessTokens: [{ tokenHash: 'hashed-token' }] } });
    (Store.set as jest.Mock).mockImplementation(() => undefined);

    jest.isolateModules(() => {
      require('./logout-api');
    });

    await handlerPromise();

    expect(response.clearCookie).toHaveBeenCalled();
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { signedCookies: { CT: 'token' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    jest.isolateModules(() => {
      require('./logout-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
