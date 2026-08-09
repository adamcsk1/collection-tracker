import type { FastifyInstance } from 'fastify';
import { vi } from 'vitest';

export const buildApp = (request: any, response: any) => {
  request.cookies ??= {};
  request.unsignCookie ??= (value: string) => ({ valid: true, value });
  let registeredHandler: ((request: any, response: any) => unknown) | undefined;
  const captureHandler = (_path: string, guardOrHandler: any, maybeHandler?: any) => {
    registeredHandler = maybeHandler ?? guardOrHandler;
  };
  const app = {
    get: vi.fn(captureHandler),
    post: vi.fn(captureHandler),
    delete: vi.fn(captureHandler),
    put: vi.fn(captureHandler),
  } as any as FastifyInstance;

  return {
    app,
    handlerPromise: () =>
      registeredHandler ? Promise.resolve(registeredHandler(request, response)) : Promise.resolve(),
  };
};
