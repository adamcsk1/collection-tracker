import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { API_BASE_PREFIX } from '@shared/constants/api-const';
import { register } from './docs-api';

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  parseYaml: vi.fn(),
  swagger: vi.fn(),
  swaggerUi: vi.fn(),
}));

vi.mock('node:fs', () => ({ existsSync: mocks.existsSync, readFileSync: mocks.readFileSync }));
vi.mock('js-yaml', () => ({ load: mocks.parseYaml }));
vi.mock('@fastify/swagger', () => ({ default: mocks.swagger }));
vi.mock('@fastify/swagger-ui', () => ({ default: mocks.swaggerUi }));

describe('docs-api', () => {
  const app = { register: vi.fn() } as unknown as FastifyInstance;
  const packagedSpecPath = resolve(process.cwd(), 'public/server-api.yaml');
  const sourceSpecPath = resolve(process.cwd(), 'apps/server/public/server-api.yaml');

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readFileSync.mockReturnValue('openapi: 3.0.0');
    mocks.parseYaml.mockReturnValue({ openapi: '3.0.0' });
  });

  it('uses the packaged API spec path when present', async () => {
    mocks.existsSync.mockImplementation((path) => path === packagedSpecPath);

    await register(app);

    expect(mocks.readFileSync).toHaveBeenCalledWith(packagedSpecPath, 'utf-8');
    expect(app.register).toHaveBeenCalledWith(mocks.swagger, {
      mode: 'static',
      specification: { document: { openapi: '3.0.0' } },
    });
    expect(app.register).toHaveBeenCalledWith(mocks.swaggerUi, { routePrefix: `${API_BASE_PREFIX}/docs` });
  });

  it('falls back to the source API spec path during development', async () => {
    mocks.existsSync.mockImplementation((path) => path === sourceSpecPath);

    await register(app);

    expect(mocks.readFileSync).toHaveBeenCalledWith(sourceSpecPath, 'utf-8');
  });

  it('throws when the API spec cannot be found', async () => {
    mocks.existsSync.mockReturnValue(false);

    await expect(register(app)).rejects.toThrow('Could not find server API specification file.');
  });
});
