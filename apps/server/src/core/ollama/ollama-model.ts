export interface OllamaGenerateResponse {
  response?: string;
  done?: boolean;
  done_reason?: string;
}

export interface OllamaTagsResponse {
  models?: Array<{ name: string }>;
}
