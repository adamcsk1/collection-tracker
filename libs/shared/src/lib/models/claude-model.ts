export interface ClaudeQueryRequestModel {
  prompt: string;
}

export interface ClaudeQueryResponseModel {
  matchedIds: string[];
}

export const CLAUDE_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];

export type ClaudeModel = (typeof CLAUDE_MODELS)[number];
