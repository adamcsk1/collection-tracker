import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { Store } from '../core/store/store';
import { FILENAME_PATTERN, MD_TEMPLATE } from '@shared/constants/parser-const';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@server/core/store/store');

describe('get-parser-config-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns defaults when the user has no parser config', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({});

    const { register } = await import('./get-parser-config-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        mdTemplate: MD_TEMPLATE,
        filenamePattern: FILENAME_PATTERN,
      })
    );
  });

  it('returns the stored parser config for the user', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({ user: { filenamePattern: '{{Title}}.md' } });

    const { register } = await import('./get-parser-config-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ filenamePattern: '{{Title}}.md' });
  });
});
