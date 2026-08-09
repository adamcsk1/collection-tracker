import { describe, expect, it } from 'vitest';
import { isExternalItemIdentitySourceName, isExternalMetadataProviderName } from './external-metadata-provider-util';

describe('isExternalMetadataProviderName', () => {
  it('accepts known providers', () => {
    expect(isExternalMetadataProviderName('omdb')).toBe(true);
    expect(isExternalMetadataProviderName('openlibrary')).toBe(true);
  });

  it('rejects unknown providers', () => {
    expect(isExternalMetadataProviderName('imdb')).toBe(false);
    expect(isExternalMetadataProviderName('isbn')).toBe(false);
    expect(isExternalMetadataProviderName('unknown')).toBe(false);
  });
});

describe('isExternalItemIdentitySourceName', () => {
  it('accepts providers and identity sources', () => {
    expect(isExternalItemIdentitySourceName('omdb')).toBe(true);
    expect(isExternalItemIdentitySourceName('openlibrary')).toBe(true);
    expect(isExternalItemIdentitySourceName('imdb')).toBe(true);
    expect(isExternalItemIdentitySourceName('isbn')).toBe(true);
  });

  it('rejects unknown sources', () => {
    expect(isExternalItemIdentitySourceName('unknown')).toBe(false);
  });
});
