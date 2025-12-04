import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';

jest.mock('@server/core/store/store');

describe('health-api', () => {
  it('responds with Ok', () => {
    const response = mockResponse();
    const { app$ } = buildApp({}, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);

    jest.isolateModules(() => {
      require('./health-api');
    });

    expect(response.send).toHaveBeenCalledWith({ message: 'Ok' });
  });
});
