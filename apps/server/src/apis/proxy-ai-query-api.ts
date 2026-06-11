import { API_PREFIX } from '@shared/constants/api-const';
import { AiQueryRequestModel, AiQueryResponseModel } from '@shared/models/ai-model';
import { CollectionItemApiModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findAiSearchEmbedding,
  upsertAiSearchEmbedding,
} from '../core/database/repositories/ai-search-embedding-repository';
import { AiSearchCollectionItem, findCollectionItemsForAiSearch } from '../core/database/repositories/collection';
import { findReadableOwnerHashes } from '../core/database/repositories/share-repository';
import { jwtGuard } from '../core/jwt';
import { debugLog, errorLog, warningLog } from '../core/logger';
import { createOllamaClient, getOllamaConfig, validateOllamaConnection } from '../core/ollama/ollama';
import { DEFAULT_OLLAMA_EMBEDDING_MODEL } from '../core/ollama/ollama-const';
import { withErrorHandler } from '../core/utils/api-error-handler';

const SYSTEM_PROMPT = `
You are a strict movie and series collection search filter.

Goal:
Given a user's natural-language search request and a list of candidate collection items, return only the IMDb IDs of candidates that clearly match the request.
Item separator is: -------------------------------------------

Output contract:
- Return ONLY valid JSON shaped exactly like {"matchedIds":["tt0111161","tt0068646"]}.
- Include only IMDb IDs from matching candidates.
- If no candidates match, return {"matchedIds":[]}.
- Do not return scores, text, markdown, explanations, or any other keys.

Filtering rules:
- Evaluate every provided collection item independently against the user's request.
- Use only fields present in the provided items: IMDbId, title, year, genre, tags, rate, rottenTomatoesRate, metacriticRate, userRate, actors, and plot.
- Match semantic intent, not only exact words. For example, "christmas movies" can match items whose title, tags, genres, or plot clearly indicate Christmas, holidays, Santa, festive events, or Christmas settings.
- The user's request can ask for any actor, genre, title, year, decade, tag, rating, theme, mood, setting, franchise, plot idea, or combination of conditions.
- Default to excluding an item. Include it only when the provided fields clearly support the match.
- Do not mark every candidate as match:true unless every single candidate clearly matches the request.
- If the request is nonsense, impossible, unclear, or unsupported by the candidate fields, mark every candidate as match:false.
- Prefer the supplied item fields. Use public film or series knowledge only to interpret well-known titles, actors, franchises, moods, or themes.
- Do not invent facts that conflict with the supplied item fields.
- Do not invent IMDb IDs or modify them.
- Preserve the same order as the provided collection items in matchedIds.
`;

const MATCHED_IDS_FORMAT = {
  type: 'object',
  properties: {
    matchedIds: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['matchedIds'],
  additionalProperties: false,
};

const EMBEDDING_BATCH_SIZE = 32;

const stringifyPromptValue = (value: unknown): string => `${value}`.replace(/\s+/g, ' ').trim();

const readCollectionItems = (usernameHash: string): AiSearchCollectionItem[] => {
  const db = getDatabase();
  const usernameHashes = [usernameHash, ...findReadableOwnerHashes(db, usernameHash)];
  return findCollectionItemsForAiSearch(db, usernameHashes);
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
rottenTomatoesRate:
${stringifyPromptValue(item.rottenTomatoesRate)}
\n
metacriticRate:
${stringifyPromptValue(item.metacriticRate)}
\n
userRate:
${stringifyPromptValue(item.userRate)}
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
  const collectionItems = batch.map(toPromptItem).join('\n');

  return `User search request:
${question.trim()}

Candidate collection items:
${collectionItems}

Return the matchedIds JSON object only.`;
};

const cosineSimilarity = (firstEmbedding: number[], secondEmbedding: number[]): number => {
  const length = Math.min(firstEmbedding.length, secondEmbedding.length);
  let dotProduct = 0;
  let firstMagnitude = 0;
  let secondMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    const firstValue = firstEmbedding[index];
    const secondValue = secondEmbedding[index];
    dotProduct += firstValue * secondValue;
    firstMagnitude += firstValue * firstValue;
    secondMagnitude += secondValue * secondValue;
  }

  if (!firstMagnitude || !secondMagnitude) return 0;
  return dotProduct / (Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude));
};

const normalizeSearchText = (value: unknown): string =>
  `${value ?? ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getSearchTokens = (value: string): string[] =>
  normalizeSearchText(value)
    .split(' ')
    .filter((token) => token.length >= 3 || /^\d{4}$/.test(token));

const scoreTokenMatches = (text: string, tokens: string[], weight: number): number => {
  if (!text || !tokens.length) return 0;
  const matchedTokens = tokens.filter((token) => text.includes(token)).length;
  return matchedTokens ? (matchedTokens / tokens.length) * weight : 0;
};

const getLexicalScore = (prompt: string, item: AiSearchCollectionItem): number => {
  const normalizedPrompt = normalizeSearchText(prompt);
  const tokens = getSearchTokens(prompt);
  if (!normalizedPrompt && !tokens.length) return 0;

  const title = normalizeSearchText(item.title);
  const year = normalizeSearchText(item.year);
  const genres = normalizeSearchText(item.genre.join(' '));
  const tags = normalizeSearchText(item.tags.join(' '));
  const actors = normalizeSearchText(item.actors);
  const plot = normalizeSearchText(item.plot);
  const allText = normalizeSearchText(item.aiSearchText);

  let score = 0;
  if (normalizedPrompt && title.includes(normalizedPrompt)) score += 1.2;
  if (normalizedPrompt && genres.includes(normalizedPrompt)) score += 1;
  if (normalizedPrompt && tags.includes(normalizedPrompt)) score += 1;
  if (normalizedPrompt && actors.includes(normalizedPrompt)) score += 0.8;
  if (tokens.some((token) => /^\d{4}$/.test(token) && year.includes(token))) score += 1;

  score += scoreTokenMatches(title, tokens, 0.8);
  score += scoreTokenMatches(genres, tokens, 0.7);
  score += scoreTokenMatches(tags, tokens, 0.7);
  score += scoreTokenMatches(actors, tokens, 0.5);
  score += scoreTokenMatches(plot, tokens, 0.25);
  score += scoreTokenMatches(allText, tokens, 0.2);

  return Math.min(score, 2.5);
};

const getEmbeddings = async (
  client: ReturnType<typeof createOllamaClient>,
  model: string,
  input: string[],
  keepAlive: ReturnType<typeof getOllamaConfig>['keep_alive']
): Promise<number[][]> => {
  if (!input.length) return [];

  const response = await client.embed({
    model,
    input,
    ...(keepAlive !== undefined ? { keep_alive: keepAlive } : {}),
  });
  const embeddings = response.embeddings ?? [];

  if (embeddings.length !== input.length || embeddings.some((embedding) => !embedding.length)) {
    throw new Error('invalid-embeddings');
  }

  return embeddings;
};

const getRankedCandidates = async (
  prompt: string,
  items: AiSearchCollectionItem[],
  semanticCandidateLimit: number,
  client: ReturnType<typeof createOllamaClient>,
  embeddingModel: string,
  keepAlive: ReturnType<typeof getOllamaConfig>['keep_alive']
): Promise<AiSearchCollectionItem[]> => {
  const db = getDatabase();
  const queryEmbedding = (await getEmbeddings(client, embeddingModel, [prompt], keepAlive))[0];
  const embeddingsByItemId = new Map<number, number[]>();
  const uncachedItems: AiSearchCollectionItem[] = [];

  for (const item of items) {
    const cachedEmbedding = findAiSearchEmbedding(db, item.itemId, embeddingModel, item.aiSearchContentHash);
    if (cachedEmbedding) {
      embeddingsByItemId.set(item.itemId, cachedEmbedding);
    } else {
      uncachedItems.push(item);
    }
  }

  for (let itemIndex = 0; itemIndex < uncachedItems.length; itemIndex += EMBEDDING_BATCH_SIZE) {
    const batch = uncachedItems.slice(itemIndex, itemIndex + EMBEDDING_BATCH_SIZE);
    const batchEmbeddings = await getEmbeddings(
      client,
      embeddingModel,
      batch.map((item) => item.aiSearchText),
      keepAlive
    );

    batch.forEach((item, index) => {
      const embedding = batchEmbeddings[index];
      embeddingsByItemId.set(item.itemId, embedding);
      upsertAiSearchEmbedding(db, item.itemId, embeddingModel, item.aiSearchContentHash, embedding);
    });
  }

  return items
    .map((item) => ({
      item,
      score:
        cosineSimilarity(queryEmbedding, embeddingsByItemId.get(item.itemId) ?? []) + getLexicalScore(prompt, item),
    }))
    .sort((firstItem, secondItem) => secondItem.score - firstItem.score)
    .slice(0, Math.min(semanticCandidateLimit, items.length))
    .map(({ item }) => item);
};

const getMatchedIdFromAiResult = (item: unknown): string => {
  if (typeof item === 'string') return item;
  if (typeof item !== 'object' || item === null) return '';

  const parsedItem = item as { imdbid?: unknown; IMDbId?: unknown; match?: unknown };
  if (parsedItem.match !== true) return '';

  if (typeof parsedItem.imdbid === 'string') return parsedItem.imdbid;
  return typeof parsedItem.IMDbId === 'string' ? parsedItem.IMDbId : '';
};

const getMatchedIdsFromParsedResult = (parsed: unknown): string[] | undefined => {
  if (typeof parsed !== 'object' || parsed === null) return undefined;

  const parsedObject = parsed as { matchedIds?: unknown; matches?: unknown };
  const ids = parsedObject.matchedIds ?? parsedObject.matches;

  return Array.isArray(ids) && ids.every((id) => typeof id === 'string') ? ids : undefined;
};

const getMatchedIdsFromMalformedObject = (rawText: string): string[] | undefined => {
  const matches = rawText.matchAll(/"(?:IMDbId|imdbid)"\s*:\s*"(tt\d+)"\s*,\s*"match"\s*:\s*true/g);
  const matchedIds = [...matches].map((match) => match[1]);
  return matchedIds.length ? matchedIds : undefined;
};

const parseMatchedIds = (rawText: string): string[] | undefined => {
  const codeBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = codeBlock ? codeBlock[1].trim() : rawText;

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const matchedIds = getMatchedIdsFromParsedResult(parsed);
    if (matchedIds) return matchedIds;

    if (Array.isArray(parsed)) return parsed.map(getMatchedIdFromAiResult).filter(Boolean);
  } catch {
    return getMatchedIdsFromMalformedObject(rawText);
  }

  return getMatchedIdsFromMalformedObject(rawText);
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
      const embeddingModel = ollamaConfig.embeddingModel ?? DEFAULT_OLLAMA_EMBEDDING_MODEL;
      const semanticCandidateLimit = ollamaConfig.semanticCandidateLimit ?? items.length;

      const queryBatch = async (batch: CollectionItemApiModel[]): Promise<string[]> => {
        const userMessage = buildPrompt(prompt, batch);
        const validBatchImdbIds = new Set(batch.map((item) => item.IMDbId));
        const maxTokens = Math.max(64, batch.length * 12 + 32);
        const ollamaResponse = await client.generate({
          model,
          system: SYSTEM_PROMPT.trim(),
          prompt: userMessage,
          format: MATCHED_IDS_FORMAT,
          options: { num_predict: maxTokens, ...ollamaOptions },
          ...(keepAlive !== undefined ? { keep_alive: keepAlive } : {}),
        });

        if (ollamaResponse.done_reason === 'length') {
          errorLog('Ollama response was truncated (num_predict reached)');
          throw new Error('truncated');
        }

        const rawText = ollamaResponse.response ?? '';

        debugLog(`Ollama raw response for batch of ${batch.length} items:\n${rawText}`);

        const parsedMatchedIds = parseMatchedIds(rawText);

        if (!parsedMatchedIds) {
          warningLog(`Ollama returned unparseable AI search response: ${rawText}`);
          throw new Error('unexpected-shape');
        }

        const matchedIdSet = new Set(parsedMatchedIds);
        return batch
          .map((item) => item.IMDbId)
          .filter((imdbid) => validBatchImdbIds.has(imdbid) && matchedIdSet.has(imdbid));
      };

      try {
        const rankedItems = await getRankedCandidates(
          prompt,
          items,
          semanticCandidateLimit,
          client,
          embeddingModel,
          keepAlive
        );
        const batches: CollectionItemApiModel[][] = [];
        for (let itemIndex = 0; itemIndex < rankedItems.length; itemIndex += batchSize) {
          batches.push(rankedItems.slice(itemIndex, itemIndex + batchSize));
        }

        debugLog(
          `Sending AI query in ${batches.length} batches (max ${batchSize} items each, ${parallelRequests} parallel requests), model: ${model}, embedding model: ${embeddingModel}, candidates: ${rankedItems.length}/${items.length}`
        );

        const results = await queryBatches(batches, parallelRequests, queryBatch);
        const matchedIds = [...new Set(results.flat())];
        response.send({ matchedIds } as AiQueryResponseModel);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        errorLog(`AI search query failed (${message})`);
        response.code(502).send();
      }
    })
  );
};
