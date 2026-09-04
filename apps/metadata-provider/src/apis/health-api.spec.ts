import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type TestRouteHandler = (request: FastifyRequest, response: FastifyReply) => unknown;
import { describe, expect, it, vi } from 'vitest';
import { register } from './health-api';

describe('health-api', () => {
  it('returns ok', async () => {
    let handler: TestRouteHandler | undefined;
    const app = {
      get: (_path: string, routeHandler: TestRouteHandler) => {
        handler = routeHandler;
      },
    } as unknown as FastifyInstance;
    const send = vi.fn();
    register(app);
    await handler?.({} as FastifyRequest, { send } as unknown as FastifyReply);

    expect(send).toHaveBeenCalledWith({ data: { status: 'ok' } });
  });
});
