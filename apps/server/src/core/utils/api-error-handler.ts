import { errorLog } from '../logger';
import type { Request, Response } from 'express';

export const withErrorHandler =
  (handler: (request: Request, response: Response) => unknown) =>
  async (request: Request, response: Response): Promise<void> => {
    try {
      await handler(request, response);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  };
