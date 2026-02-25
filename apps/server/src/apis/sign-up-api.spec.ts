import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { mkdirSync } from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/crypto', () => ({
  generateRandomToken: vi.fn().mockReturnValue('generated-token'),
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');

  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

describe('sign-up-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (Store.set as ReturnType<typeof vi.fn> | undefined)?.mockReset?.();
    delete process.env.DISABLE_REGISTRATION;
    delete process.env.USER_LIMIT;
  });

  it('returns 400 when username is missing', async () => {
    const response = mockResponse();
    const request: any = { body: {} };
    const { app, handlerPromise } = buildApp(request, response);
    process.env.DISABLE_REGISTRATION = '0';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('returns 403 when registration disabled', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app, handlerPromise } = buildApp(request, response);
    process.env.DISABLE_REGISTRATION = '1';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(403);
  });

  it('creates user and returns token', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as ReturnType<typeof vi.fn>).mockReturnValueOnce({}).mockReturnValueOnce('/data');
    (Store.set as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '5';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(Store.set).toHaveBeenCalledWith('users', expect.any(Object));
    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining(FOLDERS.store), { recursive: true });
    expect(response.send).toHaveBeenCalledWith({ token: 'generated-token' });
  });

  it('returns 409 when user already exists', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as ReturnType<typeof vi.fn>).mockReturnValue({ 'hashed-neo': {} });
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '5';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(409);
  });

  it('returns 403 when user limit reached', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as ReturnType<typeof vi.fn>).mockReturnValue({ existing: {} });
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '0';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(403);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('fail');
    });
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '5';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
