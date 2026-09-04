import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type TestRouteHandler = (request: FastifyRequest, response: FastifyReply) => unknown;
import { afterEach, describe, expect, it, vi } from 'vitest';

const getSeriesSeasons = vi.hoisted(() => vi.fn());
vi.mock('../core/external-metadata-provider-factory', () => ({
  getExternalMetadataProviderByName: () => ({
    name: 'omdb',
    search: vi.fn(),
    getItem: vi.fn(),
    getSeriesSeasons,
  }),
}));

import { register } from './get-seasons-api';

const handle = async (providerItemId: string) => {
  let handler: TestRouteHandler | undefined;
  const app = {
    get: (_path: string, routeHandler: TestRouteHandler) => {
      handler = routeHandler;
    },
  } as unknown as FastifyInstance;
  const send = vi.fn();
  const response = { code: vi.fn(() => response), send } as unknown as FastifyReply;
  register(app);
  await handler?.({ params: { providerItemId } } as unknown as FastifyRequest, response);
  return { response, send };
};

describe('get-seasons-api', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns season metadata', async () => {
    getSeriesSeasons.mockResolvedValue([{ season: 1, episodes: 2 }]);
    const { send } = await handle('tt0133093');

    expect(getSeriesSeasons).toHaveBeenCalledWith('tt0133093');
    expect(send).toHaveBeenCalledWith({ data: { seasons: [{ season: 1, episodes: 2 }] } });
  });
});
