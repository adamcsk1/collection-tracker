import type { FastifyInstance } from 'fastify';
import { vi } from 'vitest';

export const buildApp = (request: any, response: any) => {
  request.cookies ??= {};
  request.unsignCookie ??= (value: string) => ({ valid: true, value });
  let registeredHandler: ((request: any, response: any) => unknown) | undefined;
  const captureHandler = (method: string) => (path: string, guardOrHandler: any, maybeHandler?: any) => {
    request.method ??= method;
    request.url ??= path;
    registeredHandler = maybeHandler ?? guardOrHandler;
  };
  const app = {
    createRateLimit: vi.fn(() => vi.fn().mockResolvedValue({ isAllowed: true, key: 'test' })),
    get: vi.fn(captureHandler('GET')),
    post: vi.fn(captureHandler('POST')),
    delete: vi.fn(captureHandler('DELETE')),
    put: vi.fn(captureHandler('PUT')),
  } as any as FastifyInstance;

  return {
    app,
    handlerPromise: () =>
      registeredHandler ? Promise.resolve(registeredHandler(request, response)) : Promise.resolve(),
  };
};
