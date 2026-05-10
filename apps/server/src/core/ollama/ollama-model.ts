export interface OllamaGenerateResponse {
  response?: string;
  done?: boolean;
  done_reason?: string;
}

export type OllamaGenerateOptions = Record<string, boolean | number | string>;

export type OllamaKeepAlive = number | string;

export interface OllamaConfig {
  host: string;
  model: string;
  options: OllamaGenerateOptions;
  batchSize?: number;
  parallelRequests?: number;
  keep_alive?: OllamaKeepAlive;
}

export interface OllamaTagsResponse {
  models?: Array<{ name: string }>;
}
