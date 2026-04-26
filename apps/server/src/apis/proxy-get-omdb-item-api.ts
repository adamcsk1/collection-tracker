import { OMDB_API } from '../core/constants/omdb-const';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { OMDbResponseItemModel } from '@shared/models/omdb-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/proxy/omdb/item`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
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
    })
  );
};
