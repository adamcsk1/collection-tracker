import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');

describe('change-parser-config-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when body contains non-string values', async () => {
    const response = mockResponse();
    const request: any = { body: { title: 123 }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-parser-config-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('updates parser config and returns updated config', async () => {
    const response = mockResponse();
    const request: any = {
      body: { title: 'My Title', genre: 'Drama', filenamePattern: '{{Year}}-{{Title}}.md' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({ user: { year: '2020' } });
    (Store.set as Mock).mockImplementation(() => undefined);

    const { register } = await import('./change-parser-config-api');
    register(app);

    await handlerPromise();
    expect(Store.set).toHaveBeenCalledWith('parserConfigs', expect.any(Object));
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My Title', genre: 'Drama', filenamePattern: '{{Year}}-{{Title}}.md' })
    );
  });

  it('returns 400 when filename pattern is invalid', async () => {
    const response = mockResponse();
    const request: any = {
      body: { title: 'My Title', genre: 'Drama', filenamePattern: ' ' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-parser-config-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { body: { title: 'ok' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./change-parser-config-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
