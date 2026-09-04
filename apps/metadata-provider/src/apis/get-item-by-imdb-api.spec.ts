import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type TestRouteHandler = (request: FastifyRequest, response: FastifyReply) => unknown;
import { afterEach, describe, expect, it, vi } from 'vitest';

const getItemByImdbId = vi.hoisted(() => vi.fn());
vi.mock('../core/external-metadata-provider-factory', () => ({
  getExternalMetadataProviderByName: () => ({ name: 'omdb', search: vi.fn(), getItem: vi.fn(), getItemByImdbId }),
}));

import { register } from './get-item-by-imdb-api';

const handle = async (imdbId: string) => {
  let handler: TestRouteHandler | undefined;
  const app = {
    get: (_path: string, routeHandler: TestRouteHandler) => {
      handler = routeHandler;
    },
  } as unknown as FastifyInstance;
  const send = vi.fn();
  const response = { code: vi.fn(() => response), send } as unknown as FastifyReply;
  register(app);
  await handler?.({ params: { imdbId } } as unknown as FastifyRequest, response);
  return { response, send };
};

describe('get-item-by-imdb-api', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns an item envelope', async () => {
    getItemByImdbId.mockResolvedValue({ title: 'The Matrix' });
    const { send } = await handle('tt0133093');

    expect(getItemByImdbId).toHaveBeenCalledWith('tt0133093');
    expect(send).toHaveBeenCalledWith({ data: { title: 'The Matrix' } });
  });

  it('returns 404 when the item is missing', async () => {
    getItemByImdbId.mockResolvedValue(null);
    const { response } = await handle('tt0133093');

    expect(response.code).toHaveBeenCalledWith(404);
  });
});
