import { createAnthropicClient, getAnthropicModel } from '../core/anthropic';
import { jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { ProxyClaudeCollectionItems } from '../models/proxy-claude-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { ClaudeQueryRequestModel, ClaudeQueryResponseModel } from '@shared/models/claude-model';
import { debug } from 'console';
import { getDatabase } from '../core/database/database';
import { findCollectionItemsForPrompt } from '../core/database/repositories/collection-repository';
import type { FastifyInstance } from 'fastify';

const SYSTEM_PROMPT = `
You are a movie/series classifier. Given a list of items with their full collection metadata and a question, respond ONLY with a JSON array of IMDB IDs from the provided list that match the question.
You MUST NOT include any IDs that were not in the input list.
You MUST include every single item that matches - do not skip, truncate, or summarize. Completeness is required. Keep the order of IDs the same as the input list.
If no items match, respond with an empty array.
Respond with nothing else — just the raw JSON array, no markdown.
`;

const readCollectionItems = (usernameHash: string): ProxyClaudeCollectionItems => {
  const db = getDatabase();
  return findCollectionItemsForPrompt(db, usernameHash);
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/proxy/claude/query`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const apiKey = process.env.CLAUDE_API_KEY;
      if (!apiKey) {
        response.code(503).send({ error: 'Claude API key not configured' });
        return;
      }

      const { prompt } = request.body as ClaudeQueryRequestModel;

      if (typeof prompt !== 'string' || !prompt.trim()) {
        response.code(400).send({ error: 'Invalid request body' });
        return;
      }

      const items = await readCollectionItems(request.usernameHash);

      if (!items.length) {
        response.send({ matchedIds: [] } as ClaudeQueryResponseModel);
        return;
      }

      const itemList = items.map((item) => `--- ${item.imdbId} ---\n${item.content} ---`).join('\n\n');
      const userMessage = `Items:\n${itemList}\n\nQuestion: ${prompt}`;

      const client = createAnthropicClient(apiKey);
      const maxTokens = Math.min(items.length * 15 + 256, 8192);

      debug(`Sending Claude query with ${items.length} items, maxTokens: ${maxTokens}`);

      const message = await client.messages
        .stream({
          model: getAnthropicModel(),
          max_tokens: maxTokens,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        })
        .finalMessage();

      if (message.stop_reason === 'max_tokens') {
        errorLog('Claude response was truncated (max_tokens reached)');
        response.code(502).send();
        return;
      }

      const rawText = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('');

      let parsed: unknown;
      try {
        const codeBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonText = codeBlock ? codeBlock[1].trim() : rawText;
        parsed = JSON.parse(jsonText);
      } catch {
        errorLog(`Claude returned non-JSON response: ${rawText}`);
        response.code(502).send();
        return;
      }

      if (!Array.isArray(parsed)) {
        errorLog(`Claude returned unexpected shape: ${rawText}`);
        response.code(502).send();
        return;
      }

      const inputImdbIds = new Set(items.map((item) => item.imdbId)); // Ensure we only return IDs that were in the input list
      const matchedIds = (parsed as unknown[]).filter(
        (imdbId): imdbId is string => typeof imdbId === 'string' && inputImdbIds.has(imdbId)
      );

      response.send({ matchedIds } as ClaudeQueryResponseModel);
    })
  );
};
