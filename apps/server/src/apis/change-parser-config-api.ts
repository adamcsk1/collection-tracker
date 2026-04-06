import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { ParserConfigModel } from '@server/models/parser-config-model';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.post(`${API_PREFIX}/parser/change-config`, jwtGuard, async (request, response) => {
    try {
      const body = request.body as ParserConfigModel;
      if (
        typeof body !== 'object' ||
        body === null ||
        Array.isArray(body) ||
        Object.values(body).some((value) => value !== undefined && typeof value !== 'string')
      ) {
        return response.sendStatus(400);
      }
      if (body.filenamePattern !== undefined && !body.filenamePattern.trim()) {
        return response.sendStatus(400);
      }

      const parserConfigs = Store.getLastValue('parserConfigs');
      let userConfig = parserConfigs?.[request.usernameHash];

      if (!userConfig) userConfig = {} satisfies ParserConfigModel;

      const updatedConfig = { ...userConfig, ...body } satisfies ParserConfigModel;
      parserConfigs[request.usernameHash] = updatedConfig;
      Store.set('parserConfigs', parserConfigs);

      response.send(updatedConfig);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
