import { createAnthropicClient, getAnthropicModel } from '../core/anthropic';
import { jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { FOLDERS } from '../core/main-const';
import { Store } from '../core/store/store';
import { readStoreFiles } from '../core/utils/cache-util';
import { ProxyClaudeCollectionItems } from '../models/proxy-claude-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { PARSER_REGEXPS } from '@shared/constants/parser-const';
import { ClaudeQueryRequestModel, ClaudeQueryResponseModel } from '@shared/models/claude-model';
import { restoreSerializedParserRegexp } from '@shared/utils/parser-serialize-util';
import { sanitizeMdContent } from '@shared/utils/sanitize-md-content-util';
import { debug } from 'console';
import type { Application } from 'express';

const SYSTEM_PROMPT = `
You are a movie/series classifier. Given a list of items with their full collection metadata and a question, respond ONLY with a JSON array of IMDB IDs from the provided list that match the question.
You MUST NOT include any IDs that were not in the input list.
You MUST include every single item that matches - do not skip, truncate, or summarize. Completeness is required. Keep the order of IDs the same as the input list.
If no items match, respond with an empty array.
Respond with nothing else — just the raw JSON array, no markdown.
`;

const readCollectionItems = async (storeFolder: string, usernameHash: string): Promise<ProxyClaudeCollectionItems> => {
  const parserConfigs = Store.getLastValue('parserConfigs');
  const userParserConfig = parserConfigs?.[usernameHash];

  const imdbIdRegexp = userParserConfig?.IMDbId
    ? restoreSerializedParserRegexp(userParserConfig.IMDbId)
    : PARSER_REGEXPS.IMDbId;
  const titleRegexp = userParserConfig?.title
    ? restoreSerializedParserRegexp(userParserConfig.title)
    : PARSER_REGEXPS.title;
  const contentRegexp = userParserConfig?.content
    ? restoreSerializedParserRegexp(userParserConfig.content)
    : PARSER_REGEXPS.content;

  const rawFiles = await readStoreFiles(storeFolder, usernameHash);

  return rawFiles.reduce<ProxyClaudeCollectionItems>((items, { content }) => {
    const imdbId = imdbIdRegexp.exec(content)?.groups?.['id'] ?? '';
    const title = titleRegexp.exec(content)?.groups?.['title'] ?? '';
    const plot = contentRegexp.exec(content)?.groups?.['content'] ?? '';
    const sanitizedContent = `IMDbId\n${imdbId}\n${sanitizeMdContent(
      content.replace(plot, `Plot\n${plot}`).replace(title, `Title\n${title}`)
    )}`;
    if (imdbId) items.push({ imdbId, content: sanitizedContent });
    return items;
  }, []);
};

export const register = (app: Application): void => {
  app.post(`${API_PREFIX}/proxy/claude/query`, jwtGuard, async (request, response) => {
    try {
      const apiKey = process.env.CLAUDE_API_KEY;
      if (!apiKey) {
        response.status(503).send({ error: 'Claude API key not configured' });
        return;
      }

      const { prompt } = request.body as ClaudeQueryRequestModel;

      if (typeof prompt !== 'string' || !prompt.trim()) {
        response.status(400).send({ error: 'Invalid request body' });
        return;
      }

      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${request.usernameHash}`;
      const items = await readCollectionItems(storeFolder, request.usernameHash);

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
        response.sendStatus(502);
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
        response.sendStatus(502);
        return;
      }

      if (!Array.isArray(parsed)) {
        errorLog(`Claude returned unexpected shape: ${rawText}`);
        response.sendStatus(502);
        return;
      }

      const inputImdbIds = new Set(items.map((item) => item.imdbId)); // Ensure we only return IDs that were in the input list
      const matchedIds = (parsed as unknown[]).filter(
        (imdbId): imdbId is string => typeof imdbId === 'string' && inputImdbIds.has(imdbId)
      );

      response.send({ matchedIds } as ClaudeQueryResponseModel);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
