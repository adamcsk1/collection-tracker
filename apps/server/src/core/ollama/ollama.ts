import { infoLog } from '../logger';
import { DEFAULT_OLLAMA_BASE_URL } from './ollama-const';
import { OllamaGenerateResponse, OllamaTagsResponse } from './ollama-model';

export const getOllamaBaseUrl = (): string => process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL;

export const getOllamaModel = (): string => {
  const envModel = process.env.OLLAMA_MODEL?.trim()!;
  return envModel;
};

export const validateOllamaConnection = async (): Promise<void> => {
  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaModel();

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`);

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

export const createOllamaClient = (baseUrl = getOllamaBaseUrl()) => ({
  generate: async (payload: { model: string; prompt: string; options: { num_predict: number } }) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, stream: false }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}`);
    }

    return (await response.json()) as OllamaGenerateResponse;
  },
});
