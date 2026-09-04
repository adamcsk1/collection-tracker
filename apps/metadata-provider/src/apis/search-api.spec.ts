import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type TestRouteHandler = (request: FastifyRequest, response: FastifyReply) => unknown;
import { afterEach, describe, expect, it, vi } from 'vitest';

const search = vi.hoisted(() => vi.fn());
vi.mock('../core/external-metadata-provider-factory', () => ({
  getExternalMetadataProviderByName: (providerName: string) =>
    providerName === 'openlibrary' ? { name: 'openlibrary', search, getItem: vi.fn() } : null,
}));

import { register } from './search-api';

const handle = async (provider: string, searchText: string) => {
  let handler: TestRouteHandler | undefined;
  const app = {
    get: (_path: string, routeHandler: TestRouteHandler) => {
      handler = routeHandler;
    },
  } as unknown as FastifyInstance;
  const send = vi.fn();
  const response = { code: vi.fn(() => response), send } as unknown as FastifyReply;
  register(app);
  await handler?.({ params: { provider }, query: { s: searchText } } as unknown as FastifyRequest, response);
  return { response, send };
};

describe('search-api', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns normalized search results', async () => {
    search.mockResolvedValue({ results: [] });
    const { send } = await handle('openlibrary', 'dune');

    expect(search).toHaveBeenCalledWith('dune');
    expect(send).toHaveBeenCalledWith({ data: { results: [] } });
  });

  it('returns 404 when the provider is unavailable', async () => {
    const { response } = await handle('omdb', 'dune');

    expect(response.code).toHaveBeenCalledWith(404);
  });
});
