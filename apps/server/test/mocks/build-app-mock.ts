import { BehaviorSubject } from 'rxjs';

export const buildApp = (request: any, response: any) => {
  let handlerPromise: Promise<any> | undefined;
  const app = {
    get: jest.fn((_path: string, guardOrHandler: any, maybeHandler?: any) => {
      const handler = maybeHandler ?? guardOrHandler;
      handlerPromise = Promise.resolve(handler(request, response));
    }),
    post: jest.fn((_path: string, guardOrHandler: any, maybeHandler?: any) => {
      const handler = maybeHandler ?? guardOrHandler;
      handlerPromise = Promise.resolve(handler(request, response));
    }),
    delete: jest.fn((_path: string, guardOrHandler: any, maybeHandler?: any) => {
      const handler = maybeHandler ?? guardOrHandler;
      handlerPromise = Promise.resolve(handler(request, response));
    }),
    put: jest.fn((_path: string, guardOrHandler: any, maybeHandler?: any) => {
      const handler = maybeHandler ?? guardOrHandler;
      handlerPromise = Promise.resolve(handler(request, response));
    }),
  };

  return {
    app$: new BehaviorSubject(app),
    handlerPromise: () => handlerPromise ?? Promise.resolve(),
  };
};
