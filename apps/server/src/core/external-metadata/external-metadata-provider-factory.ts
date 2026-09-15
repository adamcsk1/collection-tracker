import { ExternalMetadataProvider } from '@node/models/external-metadata-runtime-model';
import { createNormalizedHttpExternalMetadataProvider } from '@node/utils/normalized-http-provider';
import { ExternalMetadataProviderNameModel } from '@shared/models/external-metadata-provider-model';
import { isExternalMetadataProviderName } from '@shared/utils/external-metadata-provider-util';
import { getArgv } from '../argv/argv';

const DEFAULT_PROVIDER_NAMES: ExternalMetadataProviderNameModel[] = ['openlibrary', 'musicbrainz'];

let cachedProviderNames: ExternalMetadataProviderNameModel[] | null = null;

export const resetExternalMetadataProviderCache = (): void => {
  cachedProviderNames = null;
};

export const setAvailableExternalMetadataProviders = (providerNames: ExternalMetadataProviderNameModel[]): void => {
  cachedProviderNames = [...providerNames];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getMetadataServiceUrl = (): string => {
  const raw = getArgv().metadataServiceUrl.trim() || process.env.METADATA_SERVICE_URL?.trim();
  if (!raw) throw new Error('METADATA_SERVICE_URL is required');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('METADATA_SERVICE_URL must be an HTTP(S) URL without credentials');
  }
  if (url.search || url.hash) throw new Error('METADATA_SERVICE_URL must not contain a query or fragment');
  url.pathname = `${url.pathname.replace(/\/$/, '')}/`;
  return url.href;
};

const getAvailableProviderNames = (): ExternalMetadataProviderNameModel[] => {
  return cachedProviderNames ?? [...DEFAULT_PROVIDER_NAMES];
};

export const loadExternalMetadataProviders = async (): Promise<void> => {
  const response = await fetch(new URL('v1/providers', getMetadataServiceUrl()), {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`metadata service responded with ${response.status}`);
  const body: unknown = await response.json();
  const providers = isObject(body) && isObject(body.data) ? body.data.providers : undefined;
  if (!Array.isArray(providers)) throw new Error('metadata service returned invalid providers');
  cachedProviderNames = providers.flatMap((provider) => {
    if (!isObject(provider) || typeof provider.name !== 'string' || !isExternalMetadataProviderName(provider.name)) {
      return [];
    }
    return [provider.name];
  });
};

export const getExternalMetadataProviderByName = (providerName: string): ExternalMetadataProvider | null => {
  return getExternalMetadataProviders().find((provider) => provider.name === providerName) ?? null;
};

export const getExternalMetadataProviders = (): ExternalMetadataProvider[] => {
  const baseUrl = getMetadataServiceUrl();
  return getAvailableProviderNames().map((providerName) =>
    createNormalizedHttpExternalMetadataProvider(providerName, {
      baseUrl: new URL(`v1/${providerName}/`, baseUrl).href,
    })
  );
};

export const getDirectImdbExternalMetadataProvider = (): ExternalMetadataProvider | null =>
  getExternalMetadataProviders().find(
    (provider) => provider.supportsDirectImdbId === true && typeof provider.getItemByImdbId === 'function'
  ) ?? null;
