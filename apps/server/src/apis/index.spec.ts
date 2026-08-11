import fastifyCookie from '@fastify/cookie';
import fastify, { type FastifyInstance, type RouteOptions } from 'fastify';
import { load as parseYaml } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashText } from '../core/crypto';
import { getDatabase } from '../core/database/database';
import { apiResponseHook } from '../core/utils/api-response-util';
import { registerAllApis } from '.';

const HTTP_METHODS = new Set(['delete', 'get', 'patch', 'post', 'put']);
const OPENAPI_PATH = resolve(process.cwd(), 'apps/server/public/server-api.yaml');

const asRecord = (value: unknown): Record<string, unknown> => {
  expect(value).toBeTypeOf('object');
  expect(value).not.toBeNull();
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
};

const getOpenApiDocument = (): Record<string, unknown> => asRecord(parseYaml(readFileSync(OPENAPI_PATH, 'utf8')));

const resolveJsonPointer = (document: unknown, pointer: string): unknown =>
  pointer
    .slice(2)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce<unknown>((value, segment) => asRecord(value)[segment], document);

const visitValues = (value: unknown, visitor: (candidate: Record<string, unknown>) => void): void => {
  if (Array.isArray(value)) {
    for (const item of value) visitValues(item, visitor);
    return;
  }
  if (typeof value !== 'object' || value === null) return;

  const record = value as Record<string, unknown>;
  visitor(record);
  for (const child of Object.values(record)) visitValues(child, visitor);
};

const getDocumentedOperations = (document: Record<string, unknown>): Set<string> => {
  const operations = new Set<string>();
  for (const [path, pathValue] of Object.entries(asRecord(document.paths))) {
    for (const method of Object.keys(asRecord(pathValue))) {
      if (HTTP_METHODS.has(method)) operations.add(`${method.toUpperCase()} /api/v1${path}`);
    }
  }
  return operations;
};

const normalizeRoutePath = (path: string): string => path.replace(/:([^/]+)/g, '{$1}');

describe('registered API contract', () => {
  let app: FastifyInstance;
  let registeredOperations: Set<string>;

  beforeEach(async () => {
    vi.stubEnv('COOKIE_SECRET', 'contract-test-cookie-secret-value');
    vi.stubEnv('JWT_SECRET', 'contract-test-jwt-secret-value');
    vi.stubEnv('SALT', 'contract-test-salt');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => new Response('ok'))
    );

    registeredOperations = new Set<string>();
    app = fastify();
    app.addHook('onRoute', (route: RouteOptions) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      for (const method of methods) {
        const normalizedMethod = method.toUpperCase();
        if (normalizedMethod !== 'HEAD' && normalizedMethod !== 'OPTIONS' && route.url.startsWith('/api/v1')) {
          registeredOperations.add(`${normalizedMethod} ${normalizeRoutePath(route.url)}`);
        }
      }
    });
    app.addHook('onSend', apiResponseHook);
    await app.register(fastifyCookie, { secret: process.env.COOKIE_SECRET });
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('registers all routes without conflicts', async () => {
    expect(() => registerAllApis(app)).not.toThrow();
    await app.ready();
  });

  it('keeps registered methods and paths in parity with OpenAPI', async () => {
    registerAllApis(app);
    await app.ready();

    expect(registeredOperations).toEqual(getDocumentedOperations(getOpenApiDocument()));
  });

  it('parses OpenAPI with resolvable local references and unique operation IDs', () => {
    const document = getOpenApiDocument();
    const operationIds: string[] = [];

    visitValues(document, (candidate) => {
      if (typeof candidate.$ref === 'string' && candidate.$ref.startsWith('#/')) {
        expect(resolveJsonPointer(document, candidate.$ref), candidate.$ref).toBeDefined();
      }
      if (typeof candidate.operationId === 'string') operationIds.push(candidate.operationId);
    });

    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('requires read permission for first-time item share selections only', () => {
    const schemas = asRecord(asRecord(getOpenApiDocument().components).schemas);
    const requestProperties = asRecord(asRecord(schemas.CollectionItemShareSelectionPermissions).properties);
    const responseProperties = asRecord(asRecord(schemas.CollectionItemSharePermissions).properties);

    expect(asRecord(requestProperties.canRead)).toEqual({ type: 'boolean', const: true });
    expect(asRecord(responseProperties.canRead)).toEqual({ type: 'boolean' });
  });

  it('applies response envelopes to actual public and protected routes', async () => {
    registerAllApis(app);
    await app.ready();

    const healthResponse = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({
      data: expect.objectContaining({
        status: expect.stringMatching(/^(error|ok|warn)$/),
        frontend: { status: 'up' },
      }),
    });

    const unauthorizedResponse = await app.inject({ method: 'GET', url: '/api/v1/users/me/settings' });
    expect(unauthorizedResponse.statusCode).toBe(401);
    expect(unauthorizedResponse.headers['content-type']).toContain('application/problem+json');
    expect(unauthorizedResponse.json()).toEqual({
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
      code: 'HTTP_401',
      instance: '/api/v1/users/me/settings',
    });
  });

  it('preserves an actual successful sign-in as an empty 204 response', async () => {
    const username = 'contract-user';
    const token = 'contract-token';
    getDatabase()
      .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
      .run(hashText(username), hashText(token));
    registerAllApis(app);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      headers: { 'user-agent': 'contract-test' },
      payload: { username, token },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(response.headers['set-cookie']).toHaveLength(2);
  });
});
