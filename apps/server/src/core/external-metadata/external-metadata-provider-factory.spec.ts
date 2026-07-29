import { afterEach, describe, expect, it } from 'vitest';
import {
  getDirectImdbExternalMetadataProvider,
  getExternalMetadataProviderByName,
  getExternalMetadataProviders,
} from './external-metadata-provider-factory';

describe('external-metadata-provider-factory', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns the OMDb provider when OMDB_API_KEY is set', () => {
    process.env = { ...originalEnv, OMDB_API_KEY: 'key' };

    expect(getExternalMetadataProviderByName('omdb')?.name).toBe('omdb');
    expect(getDirectImdbExternalMetadataProvider()?.name).toBe('omdb');
  });

  it('returns an empty provider list when no provider is configured', () => {
    process.env = { ...originalEnv };
    delete process.env.OMDB_API_KEY;

    expect(getExternalMetadataProviders()).toEqual([]);
    expect(getDirectImdbExternalMetadataProvider()).toBeNull();
  });
});
