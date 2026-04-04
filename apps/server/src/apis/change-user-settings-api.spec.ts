import { buildApp } from '@server-mocks/build-app-mock';
import { mockResponse } from '@server-mocks/response-mock';
import { Store } from '@server/core/store/store';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@server/core/store/store');

describe('change-user-settings-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when body contains invalid values', async () => {
    const response = mockResponse();
    const request: any = { body: { fetchBatchSize: '25' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('updates user settings and returns merged config', async () => {
    const response = mockResponse();
    const request: any = { body: { theme: 'dark' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({ user: { fetchBatchSize: 25 } });
    (Store.set as Mock).mockImplementation(() => undefined);

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(Store.set).toHaveBeenCalledWith('userSettings', expect.any(Object));
    expect(response.send).toHaveBeenCalledWith({
      fetchBatchSize: 25,
      theme: 'dark',
    });
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { body: { theme: 'dark' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
