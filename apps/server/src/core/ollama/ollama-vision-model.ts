import { OllamaGenerateOptions, OllamaKeepAlive } from './ollama-model';

export interface OllamaVisionConfig {
  host: string;
  model: string;
  options: OllamaGenerateOptions;
  keep_alive?: OllamaKeepAlive;
}
