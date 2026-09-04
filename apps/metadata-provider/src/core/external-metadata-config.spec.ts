import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('external metadata config', () => {
  let dataFolder: string | null = null;
  const originalEnv = process.env;

  const importConfig = async (config?: unknown) => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-external-metadata-'));
    if (config !== undefined) {
      writeFileSync(join(dataFolder, 'external-metadata.config.json'), JSON.stringify(config), { encoding: 'utf-8' });
    }
    vi.doMock('./argv', () => ({ getArgv: () => ({ dataFolder, debug: false }) }));
    return import('./external-metadata-config');
  };

  afterEach(() => {
    if (dataFolder) rmSync(dataFolder, { recursive: true, force: true });
    dataFolder = null;
    process.env = originalEnv;
    vi.resetModules();
    vi.doUnmock('./argv');
  });

  it('returns no replacements when the config file is missing', async () => {
    const { getExternalMetadataConfig } = await importConfig();

    expect(getExternalMetadataConfig()).toEqual({});
  });

  it('loads and normalizes configured provider replacements', async () => {
    process.env = { ...originalEnv, CUSTOM_METADATA_KEY: ' secret ' };
    const { getExternalMetadataConfig } = await importConfig({
      version: 1,
      providers: {
        omdb: {
          baseUrl: ' http://metadata.test/v1 ',
          header: { name: 'X-Api-Key', valueEnv: 'CUSTOM_METADATA_KEY' },
        },
        openlibrary: { baseUrl: 'https://books.test/' },
      },
    });

    expect(getExternalMetadataConfig()).toEqual({
      omdb: { baseUrl: 'http://metadata.test/v1/', header: { name: 'X-Api-Key', value: 'secret' } },
      openlibrary: { baseUrl: 'https://books.test/' },
    });
  });

  it.each([
    [{ version: 2, providers: {} }, 'version 1'],
    [{ version: 1, providers: { custom: { baseUrl: 'https://metadata.test' } } }, 'Unsupported'],
    [{ version: 1, providers: { omdb: { baseUrl: 'file:///metadata' } } }, 'HTTP(S)'],
    [{ version: 1, providers: { omdb: { baseUrl: 'https://user:pass@metadata.test' } } }, 'credentials'],
    [
      {
        version: 1,
        providers: {
          omdb: { baseUrl: 'https://metadata.test', header: { name: 'Cookie', valueEnv: 'CUSTOM_METADATA_KEY' } },
        },
      },
      'not allowed',
    ],
  ])('rejects invalid configuration', async (config, message) => {
    process.env = { ...originalEnv, CUSTOM_METADATA_KEY: 'secret' };
    const { getExternalMetadataConfig } = await importConfig(config);

    expect(() => getExternalMetadataConfig()).toThrow(message);
  });

  it('rejects a missing custom header environment value without exposing a secret', async () => {
    process.env = { ...originalEnv };
    delete process.env.CUSTOM_METADATA_KEY;
    const { getExternalMetadataConfig } = await importConfig({
      version: 1,
      providers: {
        omdb: {
          baseUrl: 'https://metadata.test',
          header: { name: 'Authorization', valueEnv: 'CUSTOM_METADATA_KEY' },
        },
      },
    });

    expect(() => getExternalMetadataConfig()).toThrow('references missing or empty CUSTOM_METADATA_KEY');
  });

  it('ignores later config file edits after the first load', async () => {
    const { getExternalMetadataConfig } = await importConfig({
      version: 1,
      providers: { openlibrary: { baseUrl: 'https://books.test/' } },
    });

    expect(getExternalMetadataConfig()).toEqual({ openlibrary: { baseUrl: 'https://books.test/' } });
    writeFileSync(
      join(dataFolder!, 'external-metadata.config.json'),
      JSON.stringify({ version: 1, providers: { musicbrainz: { baseUrl: 'https://music.test/' } } }),
      { encoding: 'utf-8' }
    );

    expect(getExternalMetadataConfig()).toEqual({ openlibrary: { baseUrl: 'https://books.test/' } });
  });
});
