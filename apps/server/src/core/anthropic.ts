import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_MODEL } from '@server/core/anthropic-const';
import { warningLog } from '@server/core/logger';
import { CLAUDE_MODELS, ClaudeModel } from '@shared/models/claude-model';

export const createAnthropicClient = (apiKey: string): Anthropic => new Anthropic({ apiKey, maxRetries: 5 });

export const getAnthropicModel = (): string | ClaudeModel | undefined => {
  const envModel = process.env.CLAUDE_MODEL?.trim() as string | ClaudeModel | undefined;

  if (envModel && !CLAUDE_MODELS.includes(envModel)) {
    warningLog(
      `Unknown Claude model specified in environment variable: ${envModel}. Maybe that could work, but it's safer to use a known model. Please check the available models and update your configuration.`
    );
  }

  if (!envModel) {
    warningLog(
      `No Claude model specified in environment variable. Defaulting to ${DEFAULT_MODEL}. If you want to use a different model, please set the CLAUDE_MODEL environment variable to one of the following: ${CLAUDE_MODELS.join(
        ', '
      )}.`
    );
  }

  return envModel || DEFAULT_MODEL;
};
