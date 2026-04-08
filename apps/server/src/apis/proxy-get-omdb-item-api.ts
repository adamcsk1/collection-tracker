import { OMDB_API } from '../core/constants/omdb-const';
import { jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { API_PREFIX } from '@shared/constants/api-const';
import { OMDbResponseItemModel } from '@shared/models/omdb-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(`${API_PREFIX}/proxy/omdb/item`, jwtGuard, async (request, response) => {
    try {
      const apiKey = process.env.OMDB_API_KEY;
      if (!apiKey) {
        response.sendStatus(503);
        return;
      }

      const url = new URL(OMDB_API);
      url.searchParams.append('i', String(request.query.i ?? ''));
      url.searchParams.append('apikey', apiKey);

      const result = await fetch(url.href);
      response.send((await result.json()) as OMDbResponseItemModel);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
