import { API_PREFIX } from '@shared/constants/api-const';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';

vi.mock('@server/core/health/health', () => ({
  getHealth: vi.fn().mockResolvedValue({ status: 'ok', memory: { usedPercent: 50 } }),
}));

describe('user-health-api', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns health diagnostics', async () => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({}, response);
    const { register } = await import('./user-health-api');

    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ status: 'ok', memory: { usedPercent: 50 } });
  });

  it('registers authentication and the shared health rate limit', async () => {
    vi.stubEnv('HEALTH_RATE_LIMIT', '123');
    const { app } = buildApp({}, mockResponse());
    const { register } = await import('./user-health-api');

    register(app);

    expect(app.get).toHaveBeenCalledWith(
      `${API_PREFIX}/users/me/health`,
      {
        preHandler: [expect.any(Function), expect.any(Function)],
        config: { rateLimit: { max: 123, timeWindow: '1 minute', groupId: 'health' } },
      },
      expect.any(Function)
    );
  });
});
