export interface OllamaGenerateResponse {
  response?: string;
  done?: boolean;
  done_reason?: string;
}

export interface OllamaEmbedResponse {
  embeddings?: number[][];
}

export type OllamaGenerateOptions = Record<string, boolean | number | string>;
export type OllamaGenerateFormat = 'json' | Record<string, unknown>;

export type OllamaKeepAlive = number | string;

export interface OllamaConfig {
  host: string;
  model: string;
  embeddingModel?: string;
  options: OllamaGenerateOptions;
  batchSize?: number;
  parallelRequests?: number;
  semanticCandidateLimit?: number;
  keep_alive?: OllamaKeepAlive;
}

export interface OllamaTagsResponse {
  models?: Array<{ name: string }>;
}
