import { API_BASE_PREFIX } from '@shared/constants/api-const';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { load as parseYaml } from 'js-yaml';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { OpenAPIV3 } from 'openapi-types';

export const register = async (app: FastifyInstance): Promise<void> => {
  const possibleSpecPaths = [
    resolve(process.cwd(), 'public/server-api.yaml'),
    resolve(process.cwd(), 'apps/server/public/server-api.yaml'),
    resolve(__dirname, '../../../../public/server-api.yaml'),
  ];
  const specPath = possibleSpecPaths.find((path) => existsSync(path));
  if (!specPath) throw new Error('Could not find server API specification file.');
  const spec = parseYaml(readFileSync(specPath, 'utf-8')) as OpenAPIV3.Document;
  await app.register(fastifySwagger, { mode: 'static', specification: { document: spec } });
  await app.register(fastifySwaggerUi, { routePrefix: `${API_BASE_PREFIX}/docs` });
};
