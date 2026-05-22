import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertSeriesTrackerItem } from '../../test/mocks/series-tracker-item-mock';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('change-series-tracker-seasons-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('replaces metadata with validated manual values', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-series' },
      body: { seasons: [{ season: 2, episodes: 8 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ seasons: [{ season: 2, episodes: 8 }] });
  });

  it('rejects zero episode counts', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 0 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects episode counts above the supported range', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 101 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });
});
