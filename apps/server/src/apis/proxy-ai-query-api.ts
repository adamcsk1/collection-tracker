import { API_PREFIX } from '@shared/constants/api-const';
import { AiQueryRequestModel, AiQueryResponseModel } from '@shared/models/ai-model';
import { CollectionItemApiModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemsForPrompt } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { debugLog, errorLog, warningLog } from '../core/logger';
import { createOllamaClient, getOllamaConfig, validateOllamaConnection } from '../core/ollama/ollama';
import { withErrorHandler } from '../core/utils/api-error-handler';

const SYSTEM_PROMPT = `
You are a strict collection item filter for movies and series.

Goal:
Given a user's natural-language search request and a list of candidate collection items, decide which candidates match the request.
Item separator is: -------------------------------------------

Output contract:
- Return ONLY a valid JSON array of decision objects.
- Return exactly one object for each candidate item, in the same order as the candidates.
- Each object must be shaped exactly like {"IMDbId":"tt0111161","match":true}.
- Use match:true only when the candidate clearly matches the user's request; otherwise use match:false.
- Do not return scores, text, markdown, or explanations.

Filtering rules:
- Evaluate every provided collection item independently against the user's request.
- Use only fields present in the provided items: IMDbId, title, year, genre, tags, rate, actors, and plot.
- Match semantic intent, not only exact words. For example, "christmas movies" can match items whose title, tags, genres, or plot clearly indicate Christmas, holidays, Santa, festive events, or Christmas settings.
- The user's request can ask for any actor, genre, title, year, decade, tag, rating, theme, mood, setting, franchise, plot idea, or combination of conditions.
- Default to excluding an item. Include it only when the provided fields clearly support the match.
- Do not mark every candidate as match:true unless every single candidate clearly matches the request.
- If the request is nonsense, impossible, unclear, or unsupported by the candidate fields, mark every candidate as match:false.
- Use outside knowledge about films or series if possible.
- Do not infer facts that are not present in the item fields.
- Do not invent IMDb IDs or modify them.
- Preserve the same order as the provided collection items.
`;

const stringifyPromptValue = (value: unknown): string => `${value}`.replace(/\s+/g, ' ').trim();

const readCollectionItems = (usernameHash: string): CollectionItemApiModel[] => {
  const db = getDatabase();
  return findCollectionItemsForPrompt(db, usernameHash);
};

const toPromptItem = (item: CollectionItemApiModel): string => {
  try {
    return `
-------------------------------------------
IMDbId:
${stringifyPromptValue(item.IMDbId)}
\n
title:
${stringifyPromptValue(item.title)}
\n
year:
${stringifyPromptValue(item.year)}
\n
genre:
${stringifyPromptValue(item.genre)}
\n
tags:
${stringifyPromptValue(item.tags)}
\n
rate:
${stringifyPromptValue(item.rate)}
\n
actors:
${stringifyPromptValue(item.actors)}
\n
plot:
${stringifyPromptValue(item.plot)}
\n
\n
`;
  } catch {
    return '';
  }
};

const buildPrompt = (question: string, batch: CollectionItemApiModel[]): string => {
  const collectionItems = batch.map(toPromptItem);

  return `User search request:
${question.trim()}

Candidate collection items:
${collectionItems}

Return the decision-object JSON array only.`;
};

const getMatchedIdFromAiResult = (item: unknown): string => {
  if (typeof item === 'string') return item;
  if (typeof item !== 'object' || item === null) return '';

  const parsedItem = item as { imdbid?: unknown; IMDbId?: unknown; match?: unknown };
  if (parsedItem.match !== true) return '';

  if (typeof parsedItem.imdbid === 'string') return parsedItem.imdbid;
  return typeof parsedItem.IMDbId === 'string' ? parsedItem.IMDbId : '';
};

const queryBatches = async (
  batches: CollectionItemApiModel[][],
  parallelRequests: number,
  queryBatch: (batch: CollectionItemApiModel[]) => Promise<string[]>
): Promise<string[][]> => {
  const results: string[][] = [];
  let nextBatchIndex = 0;
  let failure: unknown;

  const workerCount = Math.min(parallelRequests, batches.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextBatchIndex < batches.length && !failure) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;
      try {
        results[batchIndex] = await queryBatch(batches[batchIndex]);
      } catch (error: unknown) {
        failure = error;
      }
    }
  });

  await Promise.all(workers);

  if (failure) throw failure;

  return results;
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/proxy/ai/query`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const ollamaConfig = getOllamaConfig();
      const model = ollamaConfig.model;

      const { prompt } = request.body as AiQueryRequestModel;

      if (typeof prompt !== 'string' || !prompt.trim()) {
        response.code(400).send({ error: 'Invalid request body' });
        return;
      }

      try {
        await validateOllamaConnection();
      } catch {
        response.code(502).send();
        return;
      }

      const items = await readCollectionItems(request.usernameHash);

      if (!items.length) {
        response.send({ matchedIds: [] } as AiQueryResponseModel);
        return;
      }

      const configBatchSize = ollamaConfig.batchSize;
      const batchSize = configBatchSize ?? items.length;
      const parallelRequests = ollamaConfig.parallelRequests ?? 1;
      const client = createOllamaClient();
      const keepAlive = ollamaConfig.keep_alive;
      const ollamaOptions = ollamaConfig.options;

      const queryBatch = async (batch: CollectionItemApiModel[]): Promise<string[]> => {
        const userMessage = buildPrompt(prompt, batch);
        const validBatchImdbIds = new Set(batch.map((item) => item.IMDbId));
        const maxTokens = Math.max(128, batch.length * 32 + 64);
        const ollamaResponse = await client.generate({
          model,
          system: SYSTEM_PROMPT.trim(),
          prompt: userMessage,
          options: { num_predict: maxTokens, ...ollamaOptions },
          ...(keepAlive !== undefined ? { keep_alive: keepAlive } : {}),
        });

        if (ollamaResponse.done_reason === 'length') {
          errorLog('Ollama response was truncated (num_predict reached)');
          throw new Error('truncated');
        }

        const rawText = ollamaResponse.response ?? '';

        debugLog(`Ollama raw response for batch of ${batch.length} items:\n${rawText}`);

        let parsed: unknown;
        try {
          const codeBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
          const jsonText = codeBlock ? codeBlock[1].trim() : rawText;
          parsed = JSON.parse(jsonText);
        } catch {
          errorLog(`Ollama returned non-JSON response: ${rawText}`);
          throw new Error('invalid-json');
        }

        if (!Array.isArray(parsed)) {
          warningLog(`Ollama returned unexpected shape: ${rawText}`);
          throw new Error('unexpected-shape');
        }

        return parsed
          .map(getMatchedIdFromAiResult)
          .filter((imdbid): imdbid is string => typeof imdbid === 'string' && validBatchImdbIds.has(imdbid));
      };

      const batches: CollectionItemApiModel[][] = [];
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += batchSize) {
        batches.push(items.slice(itemIndex, itemIndex + batchSize));
      }

      debugLog(
        `Sending AI query in ${batches.length} batches (max ${batchSize} items each, ${parallelRequests} parallel requests), model: ${model}`
      );

      try {
        const results = await queryBatches(batches, parallelRequests, queryBatch);
        const matchedIds = [...new Set(results.flat())];
        response.send({ matchedIds } as AiQueryResponseModel);
      } catch {
        response.code(502).send();
      }
    })
  );
};
