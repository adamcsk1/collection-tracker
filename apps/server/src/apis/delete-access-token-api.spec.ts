import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';

jest.mock('@server/core/store/store');

describe('delete-access-token-api', () => {
  afterEach(() => jest.clearAllMocks());

  it('deletes matching access token', async () => {
    const response = mockResponse();
    const request: any = { params: { tokenHash: 'remove' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue({
      user: { accessTokens: [{ tokenHash: 'keep' }, { tokenHash: 'remove' }] },
    });
    const setSpy = jest.spyOn(Store, 'set');

    jest.isolateModules(() => {
      require('./delete-access-token-api');
    });

    await handlerPromise();
    expect(setSpy).toHaveBeenCalledWith('users', { user: { accessTokens: [{ tokenHash: 'keep' }] } });
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { params: { tokenHash: 'remove' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    jest.isolateModules(() => {
      require('./delete-access-token-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
