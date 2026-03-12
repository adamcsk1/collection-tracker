import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');

describe('tag-config-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns caller tag configs', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({
      user: [
        {
          tag: '#a',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ],
    });

    const { register } = await import('./tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith([
      {
        tag: '#a',
        color: '#111111',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
    ]);
  });

  it('returns empty array when caller has no stored tag config', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({});

    const { register } = await import('./tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith([]);
  });

  it('returns empty array when tag config storage is null', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue(null);

    const { register } = await import('./tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith([]);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });

  it('returns 500 when a non-Error value is thrown', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw 'fail';
    });

    const { register } = await import('./tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
