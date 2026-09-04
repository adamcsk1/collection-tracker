import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addHook: vi.fn(),
  dotenvConfig: vi.fn(),
  errorLog: vi.fn(),
  loadExternalMetadataProviders: vi.fn(),
  initializeFolders: vi.fn(),
  listen: vi.fn(async () => undefined),
  register: vi.fn(async () => undefined),
  registerAllApis: vi.fn(),
  registerDocsApi: vi.fn(async () => undefined),
}));

vi.mock('@fastify/cookie', () => ({ default: vi.fn() }));
vi.mock('@fastify/cors', () => ({ default: vi.fn() }));
vi.mock('@fastify/formbody', () => ({ default: vi.fn() }));
vi.mock('@fastify/helmet', () => ({ default: vi.fn() }));
vi.mock('@fastify/rate-limit', () => ({ default: vi.fn() }));
vi.mock('dotenv', () => ({ default: { config: mocks.dotenvConfig } }));
vi.mock('fastify', () => ({
  default: vi.fn(() => ({ addHook: mocks.addHook, listen: mocks.listen, register: mocks.register })),
}));
vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(() => true),
}));
vi.mock('../apis', () => ({ registerAllApis: mocks.registerAllApis }));
vi.mock('../apis/docs-api', () => ({ register: mocks.registerDocsApi }));
vi.mock('../tools/initializer', () => ({ initializeFolders: mocks.initializeFolders }));
vi.mock('./argv/argv', () => ({ getArgv: () => ({ dataFolder: '.data', debug: false, metadataServiceUrl: '' }) }));
vi.mock('./background/background', () => ({ warmBackgroundImages: vi.fn() }));
vi.mock('./database/database', () => ({ initializeDatabase: vi.fn(() => ({})) }));
vi.mock('./database/migrations', () => ({ hasSqlMigrations: vi.fn(() => true), runMigrations: vi.fn() }));
vi.mock('./external-metadata/external-metadata-provider-factory', () => ({
  loadExternalMetadataProviders: mocks.loadExternalMetadataProviders,
  setAvailableExternalMetadataProviders: vi.fn(),
}));
vi.mock('./logger', () => ({ debugLog: vi.fn(), errorLog: mocks.errorLog, infoLog: vi.fn() }));
vi.mock('./utils/api-response-util', () => ({ apiResponseHook: vi.fn() }));
vi.mock('./utils/environment-util', () => ({ validateEnvironment: vi.fn() }));
vi.mock('./utils/rate-limit-util', () => ({ getGlobalRateLimit: vi.fn(() => 120) }));
vi.mock('./utils/request-url-util', () => ({ getRequestPath: vi.fn((url: string) => url) }));

import { main } from './main';

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOST = '127.0.0.1';
    process.env.PORT = '3000';
    process.env.COOKIE_SECRET = 'cookie-secret';
    process.env.METADATA_SERVICE_READY_ATTEMPTS = '1';
    process.env.METADATA_SERVICE_READY_DELAY_MS = '0';
  });

  it('loads the data-folder environment before waiting for the metadata service', async () => {
    let environmentLoaded = false;
    mocks.dotenvConfig.mockImplementation(() => {
      environmentLoaded = true;
      return {};
    });
    mocks.loadExternalMetadataProviders.mockImplementation(async () => {
      expect(environmentLoaded).toBe(true);
    });

    await main();

    expect(mocks.listen).toHaveBeenCalledWith({ port: 3000, host: '127.0.0.1' });
  });

  it('stops startup when the metadata service is unavailable', async () => {
    mocks.loadExternalMetadataProviders.mockRejectedValue(new Error('metadata service is unavailable'));
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await main();

    expect(mocks.initializeFolders).not.toHaveBeenCalled();
    expect(mocks.listen).not.toHaveBeenCalled();
    expect(mocks.errorLog).toHaveBeenCalledWith('Server start unknown error (metadata service is unavailable)');
    expect(exit).toHaveBeenCalledWith(1);
    exit.mockRestore();
  });
});
