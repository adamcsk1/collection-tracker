import type { Request, Response } from 'express';
import { errorLog } from '../logger';

export const withErrorHandler =
  (handler: (request: Request, response: Response) => unknown) =>
  async (request: Request, response: Response): Promise<void> => {
    try {
      await handler(request, response);
    } catch (error: unknown) {
      if (error instanceof Error) {
        await errorLog(`Unknown error at ${request.method} ${request.originalUrl} (${error.stack ?? error.message})`);
      }
      response.sendStatus(500);
    }
  };
