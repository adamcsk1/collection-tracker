import { API_PREFIX } from '@shared/constants/api-const';
import { AiQueryRequestModel, AiQueryResponseModel } from '@shared/models/ai-model';
import { getIMDbId } from '@shared/omdb/get-imdb-id-util';
import { debug } from 'console';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemsForPrompt } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { createOllamaClient, getOllamaModel } from '../core/ollama/ollama';
import { withErrorHandler } from '../core/utils/api-error-handler';

const SYSTEM_PROMPT = `
You are a strict movie collection matcher.

Rules:
- Return with a JSON array of IMDb IDs that match the user's question based on the provided items.
- Do not use markdown.
- Do not invent facts.
`;

const readCollectionItems = (usernameHash: string): string[] => {
  const db = getDatabase();
  return findCollectionItemsForPrompt(db, usernameHash);
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/proxy/ai/query`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const model = getOllamaModel();

      const { prompt } = request.body as AiQueryRequestModel;

      if (typeof prompt !== 'string' || !prompt.trim()) {
        response.code(400).send({ error: 'Invalid request body' });
        return;
      }

      const items = await readCollectionItems(request.usernameHash);

      if (!items.length) {
        response.send({ matchedIds: [] } as AiQueryResponseModel);
        return;
      }

      const BATCH_SIZE = 5;
      const client = createOllamaClient();

      const queryBatch = async (batch: string[]): Promise<string[]> => {
        const itemList = batch.join('\n\n');
        const userMessage = `SYSTEM: ${SYSTEM_PROMPT}\nTASK:\n${prompt}\n\nCANDIDATES:\n${itemList}`;
        const maxTokens = batch.length * 15 + 256;

        const ollamaResponse = await client.generate({
          model,
          prompt: userMessage,
          options: { num_predict: maxTokens },
        });

        if (ollamaResponse.done_reason === 'length') {
          errorLog('Ollama response was truncated (num_predict reached)');
          throw new Error('truncated');
        }

        const rawText = ollamaResponse.response ?? '';

        let parsed: unknown;
        try {
          const codeBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
          const jsonText = codeBlock ? codeBlock[1].trim() : rawText;
          parsed = JSON.parse(jsonText);
        } catch {
          errorLog(`Ollama returned non-JSON response: ${rawText}`);
          throw new Error('non-json');
        }

        if (!Array.isArray(parsed)) {
          errorLog(`Ollama returned unexpected shape: ${rawText}`);
          throw new Error('unexpected-shape');
        }

        return (parsed as unknown[]).filter(
          (imdbId): imdbId is string => typeof imdbId === 'string' && !!getIMDbId(imdbId)
        );
      };

      const batches: string[][] = [];
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        batches.push(items.slice(i, i + BATCH_SIZE));
      }

      debug(`Sending AI query in ${batches.length} batches (max ${BATCH_SIZE} items each), model: ${model}`);

      try {
        const results = await Promise.all(batches.map(queryBatch));
        const matchedIds = results.flat();
        response.send({ matchedIds } as AiQueryResponseModel);
      } catch {
        response.code(502).send();
      }
    })
  );
};
