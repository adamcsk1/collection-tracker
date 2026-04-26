import { API_BASE_PREFIX } from '@shared/constants/api-const';
import { Application } from 'express';
import { load as parseYaml } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import swaggerUi from 'swagger-ui-express';

export const register = (app: Application): void => {
  const specPath = resolve(__dirname, '../../../../public/server-api.yaml');
  const spec = parseYaml(readFileSync(specPath, 'utf-8')) as object;
  app.use(`${API_BASE_PREFIX}/docs`, swaggerUi.serve, swaggerUi.setup(spec));
};
