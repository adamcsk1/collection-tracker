import { jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { FOLDERS } from '../core/main-const';
import { Store } from '../core/store/store';
import { updateItem } from '../core/utils/cache-util';
import { hashFileExists } from '../core/utils/hash-util';
import { API_PREFIX } from '@shared/constants/api-const';
import { CreateApiRequestModel, CreateApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';
import { existsSync } from 'fs';

const getAvailableFileName = (storeFolder: string, name: string): string => {
  if (!existsSync(`${storeFolder}/${name}`)) return name;

  const baseName = name.slice(0, -3);
  let index = 1;

  while (true) {
    const nextName = `${baseName}-${index}.md`;
    if (!existsSync(`${storeFolder}/${nextName}`)) return nextName;
    index += 1;
  }
};

export const register = (app: Application): void => {
  app.post(`${API_PREFIX}/create`, jwtGuard, async (request, response) => {
    try {
      let { content, name } = request.body as CreateApiRequestModel;
      if (typeof content !== 'string' || typeof name !== 'string') {
        return response.sendStatus(400);
      }
      name = name.toString().trim().replace(/\\|\//g, '');
      if (!name || !name.toLowerCase().endsWith('.md')) {
        return response.sendStatus(400);
      }
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${request.usernameHash}`;
      name = getAvailableFileName(storeFolder, name);

      if (hashFileExists(storeFolder, name)) {
        return response.sendStatus(409);
      }

      await updateItem(name, request.usernameHash, content);

      const result: CreateApiResponseModel = { name };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
