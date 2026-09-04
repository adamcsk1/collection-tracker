import { EXTERNAL_METADATA_PROVIDER_NAMES } from '@shared/models/external-metadata-provider-model';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getArgv } from './argv';
import { EXTERNAL_METADATA_CONFIG_FILE_NAME, EXTERNAL_METADATA_CONFIG_VERSION } from './external-metadata-config-const';
import { ExternalMetadataConfig, ExternalMetadataProviderReplacementConfig } from './external-metadata-config-model';

const ENVIRONMENT_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BLOCKED_HEADER_NAMES = new Set([
  'accept',
  'connection',
  'content-length',
  'cookie',
  'host',
  'proxy-authorization',
  'transfer-encoding',
]);

let cachedConfig: ExternalMetadataConfig | null = null;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseProvider = (providerName: string, value: unknown): ExternalMetadataProviderReplacementConfig => {
  if (!isObject(value) || typeof value.baseUrl !== 'string' || !value.baseUrl.trim()) {
    throw new Error(`${providerName}.baseUrl must be a non-empty HTTP(S) URL`);
  }

  const baseUrl = new URL(value.baseUrl.trim());
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
    throw new Error(`${providerName}.baseUrl must be an HTTP(S) URL without credentials`);
  }
  if (baseUrl.search || baseUrl.hash) throw new Error(`${providerName}.baseUrl must not contain a query or fragment`);
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}/`;

  if (value.header === undefined) return { baseUrl: baseUrl.href };
  if (!isObject(value.header) || typeof value.header.name !== 'string' || typeof value.header.valueEnv !== 'string') {
    throw new Error(`${providerName}.header must contain name and valueEnv strings`);
  }

  const headerName = value.header.name.trim();
  const valueEnv = value.header.valueEnv.trim();
  if (!headerName || BLOCKED_HEADER_NAMES.has(headerName.toLowerCase())) {
    throw new Error(`${providerName}.header.name is not allowed`);
  }
  try {
    new Headers({ [headerName]: 'value' });
  } catch {
    throw new Error(`${providerName}.header.name is invalid`);
  }
  if (!ENVIRONMENT_VARIABLE_NAME.test(valueEnv)) {
    throw new Error(`${providerName}.header.valueEnv is not a valid environment variable name`);
  }

  const headerValue = process.env[valueEnv]?.trim();
  if (!headerValue) throw new Error(`${providerName}.header.valueEnv references missing or empty ${valueEnv}`);
  try {
    new Headers({ [headerName]: headerValue });
  } catch {
    throw new Error(`${providerName}.header.valueEnv contains an invalid HTTP header value`);
  }

  return { baseUrl: baseUrl.href, header: { name: headerName, value: headerValue } };
};

export const getExternalMetadataConfig = (): ExternalMetadataConfig => {
  if (cachedConfig !== null) return cachedConfig;

  const configPath = join(getArgv().dataFolder, EXTERNAL_METADATA_CONFIG_FILE_NAME);
  if (!existsSync(configPath)) {
    cachedConfig = {};
    return cachedConfig;
  }

  const parsed: unknown = JSON.parse(readFileSync(configPath, { encoding: 'utf-8' }));
  if (!isObject(parsed) || parsed.version !== EXTERNAL_METADATA_CONFIG_VERSION || !isObject(parsed.providers)) {
    throw new Error(
      `${EXTERNAL_METADATA_CONFIG_FILE_NAME} must contain version ${EXTERNAL_METADATA_CONFIG_VERSION} and a providers object`
    );
  }
  const providers = parsed.providers;

  const unknownProvider = Object.keys(providers).find(
    (providerName) => !(EXTERNAL_METADATA_PROVIDER_NAMES as readonly string[]).includes(providerName)
  );
  if (unknownProvider) throw new Error(`Unsupported external metadata provider replacement: ${unknownProvider}`);

  cachedConfig = Object.fromEntries(
    EXTERNAL_METADATA_PROVIDER_NAMES.flatMap((providerName) =>
      providers[providerName] === undefined
        ? []
        : [[providerName, parseProvider(providerName, providers[providerName])]]
    )
  );
  return cachedConfig;
};
