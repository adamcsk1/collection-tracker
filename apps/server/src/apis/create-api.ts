import { jwtGuard } from '../core/jwt';
import { FOLDERS } from '../core/main-const';
import { Store } from '../core/store/store';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { updateItem } from '../core/utils/cache-util';
import { hashFileExists } from '../core/utils/hash-util';
import { sanitizeFileName } from '../core/utils/sanitize-file-name-util';
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
  app.post(
    `${API_PREFIX}/create`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      let { content, name } = request.body as CreateApiRequestModel;
      if (typeof content !== 'string' || typeof name !== 'string') {
        return response.sendStatus(400);
      }
      name = sanitizeFileName(name.trim());
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
    })
  );
};
