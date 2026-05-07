import type { FastifyInstance } from 'fastify';
import { vi } from 'vitest';

export const buildApp = (request: any, response: any) => {
  request.cookies ??= {};
  request.unsignCookie ??= (value: string) => ({ valid: true, value });
  let handlerPromise: Promise<any> | undefined;
  const app = {
    get: vi.fn((_path: string, guardOrHandler: any, maybeHandler?: any) => {
      const handler = maybeHandler ?? guardOrHandler;
      handlerPromise = Promise.resolve(handler(request, response));
    }),
    post: vi.fn((_path: string, guardOrHandler: any, maybeHandler?: any) => {
      const handler = maybeHandler ?? guardOrHandler;
      handlerPromise = Promise.resolve(handler(request, response));
    }),
    delete: vi.fn((_path: string, guardOrHandler: any, maybeHandler?: any) => {
      const handler = maybeHandler ?? guardOrHandler;
      handlerPromise = Promise.resolve(handler(request, response));
    }),
    put: vi.fn((_path: string, guardOrHandler: any, maybeHandler?: any) => {
      const handler = maybeHandler ?? guardOrHandler;
      handlerPromise = Promise.resolve(handler(request, response));
    }),
  } as any as FastifyInstance;

  return {
    app,
    handlerPromise: () => handlerPromise ?? Promise.resolve(),
  };
};
