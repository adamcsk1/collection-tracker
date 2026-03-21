import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/response-mock';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');

describe('change-tag-config-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when body is not an array', async () => {
    const response = mockResponse();
    const request: any = { body: { tag: '#a' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('returns 400 when body contains invalid item shape', async () => {
    const response = mockResponse();
    const request: any = {
      body: [
        {
          tag: '#a',
          color: '#111111',
          useForImageBorder: 'true',
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ],
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('returns 400 when body contains non-object item', async () => {
    const response = mockResponse();
    const request: any = {
      body: [null],
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('updates user tag configs and returns updated config', async () => {
    const response = mockResponse();
    const request: any = {
      body: [
        {
          tag: '#a',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ],
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({});
    (Store.set as Mock).mockImplementation(() => undefined);

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(Store.set).toHaveBeenCalledWith('tagConfigs', expect.any(Object));
    expect(response.send).toHaveBeenCalledWith(request.body);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = {
      body: [
        {
          tag: '#a',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ],
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });

  it('returns 500 when a non-Error value is thrown', async () => {
    const response = mockResponse();
    const request: any = {
      body: [
        {
          tag: '#a',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ],
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw 'fail';
    });

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
