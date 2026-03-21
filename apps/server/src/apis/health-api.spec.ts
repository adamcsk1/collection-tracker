import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/response-mock';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@server/core/store/store');

describe('health-api', () => {
  it('responds with Ok', async () => {
    const response = mockResponse();
    const { app } = buildApp({}, response);

    const { register } = await import('./health-api');
    register(app);

    expect(response.send).toHaveBeenCalledWith({ message: 'Ok' });
  });
});
