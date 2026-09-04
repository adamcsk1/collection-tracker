import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type TestRouteHandler = (request: FastifyRequest, response: FastifyReply) => unknown;
import { afterEach, describe, expect, it, vi } from 'vitest';

const getItem = vi.hoisted(() => vi.fn());
vi.mock('../core/external-metadata-provider-factory', () => ({
  getExternalMetadataProviderByName: (providerName: string) =>
    providerName === 'openlibrary' ? { name: 'openlibrary', search: vi.fn(), getItem } : null,
}));

import { register } from './get-item-api';

const handle = async (provider: string, providerItemId: string) => {
  let handler: TestRouteHandler | undefined;
  const app = {
    get: (_path: string, routeHandler: TestRouteHandler) => {
      handler = routeHandler;
    },
  } as unknown as FastifyInstance;
  const send = vi.fn();
  const response = { code: vi.fn(() => response), send } as unknown as FastifyReply;
  register(app);
  await handler?.({ params: { provider, providerItemId } } as unknown as FastifyRequest, response);
  return { response, send };
};

describe('get-item-api', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns an item envelope', async () => {
    getItem.mockResolvedValue({ title: 'Dune' });
    const { send } = await handle('openlibrary', '9780441172719');

    expect(getItem).toHaveBeenCalledWith('9780441172719');
    expect(send).toHaveBeenCalledWith({ data: { title: 'Dune' } });
  });

  it('returns 404 when the item is missing', async () => {
    getItem.mockResolvedValue(null);
    const { response } = await handle('openlibrary', '9780441172719');

    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 404 when the provider is unavailable', async () => {
    const { response } = await handle('omdb', 'tt0133093');

    expect(response.code).toHaveBeenCalledWith(404);
  });
});
