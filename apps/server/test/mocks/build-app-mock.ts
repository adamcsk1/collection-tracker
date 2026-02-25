import type { Application } from 'express';
import { vi } from 'vitest';

export const buildApp = (request: any, response: any) => {
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
  } as any as Application;

  return {
    app,
    handlerPromise: () => handlerPromise ?? Promise.resolve(),
  };
};
