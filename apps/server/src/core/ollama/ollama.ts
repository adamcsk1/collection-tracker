import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { getArgv } from '../argv/argv';
import { debugLog, infoLog } from '../logger';
import {
  DEFAULT_OLLAMA_HOST,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_OPTIONS,
  OLLAMA_CONFIG_FILE_NAME,
} from './ollama-const';
import {
  OllamaConfig,
  OllamaGenerateOptions,
  OllamaGenerateResponse,
  OllamaKeepAlive,
  OllamaTagsResponse,
} from './ollama-model';

const defaultOllamaConfig: OllamaConfig = {
  host: DEFAULT_OLLAMA_HOST,
  model: DEFAULT_OLLAMA_MODEL,
  options: DEFAULT_OLLAMA_OPTIONS,
  parallelRequests: 1,
};
const OLLAMA_CONNECTION_TIMEOUT_MS = 3000;

let cachedConfig: OllamaConfig | null = null;
let cachedMtimeMs = 0;

const isOllamaGenerateOptions = (options: unknown): options is OllamaGenerateOptions => {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) return false;

  return Object.values(options).every(
    (value) => typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string'
  );
};

const isOllamaKeepAlive = (keepAlive: unknown): keepAlive is OllamaKeepAlive => {
  if (typeof keepAlive === 'number') return Number.isFinite(keepAlive);
  return typeof keepAlive === 'string' && !!keepAlive.trim();
};

export const getOllamaConfig = (): OllamaConfig => {
  const configPath = join(getArgv().dataFolder, OLLAMA_CONFIG_FILE_NAME);

  if (!existsSync(configPath)) {
    cachedConfig = null;
    cachedMtimeMs = 0;
    debugLog(`Ollama config file not found at ${configPath}. Using default configuration.`);
    return defaultOllamaConfig;
  }

  const { mtimeMs } = statSync(configPath);

  if (cachedConfig !== null && mtimeMs <= cachedMtimeMs) {
    debugLog(`Ollama config file at ${configPath} has not changed. Using cached configuration.`);
    return cachedConfig;
  }

  const config = JSON.parse(readFileSync(configPath, { encoding: 'utf-8' })) as Partial<OllamaConfig>;

  const batchSize =
    typeof config.batchSize === 'number' && Number.isInteger(config.batchSize) && config.batchSize > 0
      ? config.batchSize
      : undefined;
  const parallelRequests =
    typeof config.parallelRequests === 'number' &&
    Number.isInteger(config.parallelRequests) &&
    config.parallelRequests > 0
      ? config.parallelRequests
      : 1;

  cachedConfig = {
    host: typeof config.host === 'string' && config.host.trim() ? config.host.trim() : DEFAULT_OLLAMA_HOST,
    model: typeof config.model === 'string' && config.model.trim() ? config.model.trim() : DEFAULT_OLLAMA_MODEL,
    options: isOllamaGenerateOptions(config.options)
      ? { ...DEFAULT_OLLAMA_OPTIONS, ...config.options }
      : DEFAULT_OLLAMA_OPTIONS,
    batchSize,
    parallelRequests,
    ...(isOllamaKeepAlive(config.keep_alive)
      ? { keep_alive: typeof config.keep_alive === 'string' ? config.keep_alive.trim() : config.keep_alive }
      : {}),
  };

  cachedMtimeMs = mtimeMs;

  debugLog(`Loaded Ollama config from ${configPath}: ${JSON.stringify(cachedConfig)}`);
  return cachedConfig;
};

export const validateOllamaConnection = async (): Promise<void> => {
  const ollamaConfig = getOllamaConfig();
  const baseUrl = ollamaConfig.host;
  const model = ollamaConfig.model;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, {
      signal: AbortSignal.timeout(OLLAMA_CONNECTION_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }

    const data = (await response.json()) as OllamaTagsResponse;
    const availableModels = data.models?.map((model) => model.name) ?? [];

    if (!availableModels.includes(model)) {
      throw new Error(
        `Ollama model "${model}" is not available. Available models: ${availableModels.join(', ') || 'none'}. Please pull the model with: ollama pull ${model}`
      );
    }

    infoLog(`Ollama connected at ${baseUrl} with model ${model}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot connect to Ollama at ${baseUrl}. ${message}. Please ensure Ollama is running and the model "${model}" is pulled.`
    );
  }
};

export const createOllamaClient = (baseUrl = getOllamaConfig().host) => ({
  generate: async (payload: {
    model: string;
    prompt: string;
    system?: string;
    options: OllamaGenerateOptions;
    keep_alive?: OllamaKeepAlive;
  }) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        stream: false,
        options: payload.options,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}`);
    }

    return (await response.json()) as OllamaGenerateResponse;
  },
});
