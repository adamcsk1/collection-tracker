import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertSeriesTrackerItem } from '../../test/mocks/series-tracker-item-mock';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('refresh-series-tracker-seasons-api', () => {
  afterEach(() => {
    delete process.env.OMDB_API_KEY;
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('refreshes metadata from OMDb and keeps partial successes', async () => {
    insertSeriesTrackerItem();
    process.env.OMDB_API_KEY = 'key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '2' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{}, {}] }) })
      .mockRejectedValueOnce(new Error('season failed'));
    vi.stubGlobal('fetch', fetchMock);
    const response = mockResponse();
    const request: any = { params: { imdbId: 'tt-series' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ seasons: [{ season: 1, episodes: 2 }] });
  });
});
