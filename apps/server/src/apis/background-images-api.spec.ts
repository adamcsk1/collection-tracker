import { API_PREFIX } from '@shared/constants/api-const';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';

describe('background-images-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../core/background/background');
    vi.unstubAllEnvs();
  });

  it('returns cached background image URLs after warmup', async () => {
    let warmupFinished = false;
    const warmBackgroundImages = vi.fn(async () => {
      warmupFinished = true;
    });
    const getCachedBackgroundImageUrls = vi.fn(async () => {
      expect(warmupFinished).toBe(true);
      return ['https://images.example/poster.jpg'];
    });
    vi.doMock('../core/background/background', () => ({
      warmBackgroundImages,
      getCachedBackgroundImageUrls,
    }));
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({}, response);
    const { register } = await import('./background-images-api');

    register(app);
    await handlerPromise();

    expect(warmBackgroundImages).toHaveBeenCalledTimes(1);
    expect(response.send).toHaveBeenCalledWith({ images: ['https://images.example/poster.jpg'] });
  });

  it('registers the dedicated image rate limit', async () => {
    vi.stubEnv('IMAGE_RATE_LIMIT', '123');
    vi.doMock('../core/background/background', () => ({
      warmBackgroundImages: vi.fn(),
      getCachedBackgroundImageUrls: vi.fn(async () => []),
    }));
    const { app } = buildApp({}, mockResponse());
    const { register } = await import('./background-images-api');

    register(app);

    expect(app.get).toHaveBeenCalledWith(
      `${API_PREFIX}/images/background`,
      {
        preHandler: expect.any(Function),
        config: { rateLimit: { max: 123, timeWindow: '1 minute', groupId: 'image' } },
      },
      expect.any(Function)
    );
  });
});
