import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dotenvConfig: vi.fn(),
  errorLog: vi.fn(),
  getExternalMetadataConfig: vi.fn(),
  listen: vi.fn(async () => undefined),
  registerAllApis: vi.fn(),
  registerRequestLogging: vi.fn(),
}));

vi.mock('dotenv', () => ({ default: { config: mocks.dotenvConfig } }));
vi.mock('fastify', () => ({
  default: vi.fn(() => ({ listen: mocks.listen })),
}));
vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(() => true),
}));
vi.mock('../apis', () => ({ registerAllApis: mocks.registerAllApis }));
vi.mock('./argv', () => ({ getArgv: () => ({ dataFolder: '.data', debug: false }) }));
vi.mock('./external-metadata-config', () => ({
  getExternalMetadataConfig: mocks.getExternalMetadataConfig,
}));
vi.mock('./logger', () => ({ errorLog: mocks.errorLog, infoLog: vi.fn() }));
vi.mock('./request-logging', () => ({ registerRequestLogging: mocks.registerRequestLogging }));

import { main } from './main';

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HOST;
    delete process.env.METADATA_PROVIDER_PORT;
  });

  it('loads environment then external metadata config before listening', async () => {
    let environmentLoaded = false;
    mocks.dotenvConfig.mockImplementation(() => {
      environmentLoaded = true;
      return {};
    });
    mocks.getExternalMetadataConfig.mockImplementation(() => {
      expect(environmentLoaded).toBe(true);
      return {};
    });

    await main();

    expect(mocks.listen).toHaveBeenCalledWith({ port: 3002, host: '127.0.0.1' });
    expect(mocks.registerRequestLogging).toHaveBeenCalledOnce();
  });

  it('stops startup when external metadata config is invalid', async () => {
    mocks.getExternalMetadataConfig.mockImplementation(() => {
      throw new Error('invalid external metadata config');
    });
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await main();

    expect(mocks.listen).not.toHaveBeenCalled();
    expect(mocks.errorLog).toHaveBeenCalledWith('Metadata provider start error (invalid external metadata config)');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
