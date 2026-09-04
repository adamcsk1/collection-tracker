import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type TestRouteHandler = (request: FastifyRequest, response: FastifyReply) => unknown;
import { describe, expect, it, vi } from 'vitest';

vi.mock('../core/external-metadata-provider-factory', () => ({
  getExternalMetadataProviders: () => [{ name: 'openlibrary', getItem: vi.fn(), search: vi.fn() }],
}));

import { register } from './list-providers-api';

describe('list-providers-api', () => {
  it('returns configured providers', async () => {
    let handler: TestRouteHandler | undefined;
    const app = {
      get: (_path: string, routeHandler: TestRouteHandler) => {
        handler = routeHandler;
      },
    } as unknown as FastifyInstance;
    const send = vi.fn();
    register(app);
    await handler?.({} as FastifyRequest, { send } as unknown as FastifyReply);

    expect(send).toHaveBeenCalledWith({
      data: {
        providers: [{ name: 'openlibrary', supportsSeasonMetadata: false, supportsDirectImdbId: false }],
      },
    });
  });
});
