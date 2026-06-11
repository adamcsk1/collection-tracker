import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ollama config', () => {
  let dataFolder: string | null = null;

  const importOllama = async (config?: object) => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-ollama-'));

    if (config) {
      writeFileSync(join(dataFolder, 'ollama.config.json'), JSON.stringify(config), { encoding: 'utf-8' });
    }

    vi.doMock('../argv/argv', () => ({ getArgv: () => ({ dataFolder, debug: false }) }));

    return import('./ollama');
  };

  afterEach(() => {
    if (dataFolder) rmSync(dataFolder, { recursive: true, force: true });
    dataFolder = null;
    vi.resetModules();
    vi.doUnmock('../argv/argv');
    vi.unstubAllGlobals();
  });

  it('returns undefined when batch size is not configured', async () => {
    const { getOllamaConfig } = await importOllama();

    expect(getOllamaConfig().batchSize).toBeUndefined();
  });

  it('reads the Ollama query batch size from the config file', async () => {
    const { getOllamaConfig } = await importOllama({ batchSize: 25 });

    expect(getOllamaConfig().batchSize).toBe(25);
  });

  it('falls back to undefined for invalid batch sizes', async () => {
    const { getOllamaConfig } = await importOllama({ batchSize: 1.5 });

    expect(getOllamaConfig().batchSize).toBeUndefined();
  });

  it('defaults Ollama parallel requests to 1', async () => {
    const { getOllamaConfig } = await importOllama();

    expect(getOllamaConfig().parallelRequests).toBe(1);
  });

  it('reads Ollama parallel requests from the config file', async () => {
    const { getOllamaConfig } = await importOllama({ parallelRequests: 3 });

    expect(getOllamaConfig().parallelRequests).toBe(3);
  });

  it('falls back to 1 for invalid parallel requests', async () => {
    const { getOllamaConfig } = await importOllama({ parallelRequests: 1.5 });

    expect(getOllamaConfig().parallelRequests).toBe(1);
  });

  it('returns undefined when keep_alive is not configured', async () => {
    const { getOllamaConfig } = await importOllama();

    expect(getOllamaConfig().keep_alive).toBeUndefined();
  });

  it('reads keep_alive from the config file', async () => {
    const { getOllamaConfig } = await importOllama({ keep_alive: '10m' });

    expect(getOllamaConfig().keep_alive).toBe('10m');
  });

  it('falls back to undefined for invalid keep_alive values', async () => {
    const { getOllamaConfig } = await importOllama({ keep_alive: '' });

    expect(getOllamaConfig().keep_alive).toBeUndefined();
  });

  it('defaults the Ollama config when the config file is missing', async () => {
    const { getOllamaConfig } = await importOllama();

    expect(getOllamaConfig()).toEqual({
      host: 'http://127.0.0.1:11434',
      model: 'qwen2.5:14b',
      embeddingModel: 'mxbai-embed-large',
      options: { temperature: 0, top_k: 10, num_thread: 10, num_ctx: 8192 },
      parallelRequests: 1,
      semanticCandidateLimit: 90,
    });
  });

  it('reads the Ollama config from the data folder config file', async () => {
    const { getOllamaConfig } = await importOllama({
      host: 'http://ollama.test',
      model: 'gemma2:2b',
      embeddingModel: 'nomic-embed-text',
      options: { temperature: 0.2, top_k: 20 },
    });

    expect(getOllamaConfig().host).toBe('http://ollama.test');
    expect(getOllamaConfig().model).toBe('gemma2:2b');
    expect(getOllamaConfig().embeddingModel).toBe('nomic-embed-text');
    expect(getOllamaConfig().options).toEqual({ temperature: 0.2, top_k: 20, num_thread: 10, num_ctx: 8192 });
  });

  it('merges configured Ollama options over deterministic defaults', async () => {
    const { getOllamaConfig } = await importOllama({ options: { num_thread: 24 } });

    expect(getOllamaConfig().options).toEqual({ temperature: 0, top_k: 10, num_thread: 24, num_ctx: 8192 });
  });

  it('reads the semantic candidate limit from the config file', async () => {
    const { getOllamaConfig } = await importOllama({ semanticCandidateLimit: 80 });

    expect(getOllamaConfig().semanticCandidateLimit).toBe(80);
  });

  it('falls back to the default semantic candidate limit for invalid values', async () => {
    const { getOllamaConfig } = await importOllama({ semanticCandidateLimit: 1.5 });

    expect(getOllamaConfig().semanticCandidateLimit).toBe(90);
  });

  it('falls back to defaults for invalid Ollama config properties', async () => {
    const { getOllamaConfig } = await importOllama({ host: ' ', model: '', options: { stop: ['invalid'] } });

    expect(getOllamaConfig()).toEqual({
      host: 'http://127.0.0.1:11434',
      model: 'qwen2.5:14b',
      embeddingModel: 'mxbai-embed-large',
      options: { temperature: 0, top_k: 10, num_thread: 10, num_ctx: 8192 },
      parallelRequests: 1,
      semanticCandidateLimit: 90,
    });
  });

  it('re-reads the config when the file has been modified', async () => {
    const { getOllamaConfig } = await importOllama({ host: 'http://initial.test' });

    expect(getOllamaConfig().host).toBe('http://initial.test');

    writeFileSync(join(dataFolder!, 'ollama.config.json'), JSON.stringify({ host: 'http://updated.test' }), {
      encoding: 'utf-8',
    });
    utimesSync(join(dataFolder!, 'ollama.config.json'), new Date(Date.now() + 1000), new Date(Date.now() + 1000));

    expect(getOllamaConfig().host).toBe('http://updated.test');
  });

  it('preserves generate options when sending requests to Ollama', async () => {
    const { createOllamaClient } = await importOllama();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: '[]' }) });
    vi.stubGlobal('fetch', fetchMock);

    await createOllamaClient('http://ollama.test').generate({
      model: 'qwen2.5:3b',
      prompt: 'prompt',
      options: { num_predict: 40, temperature: 0, top_k: 10 },
      format: 'json',
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(requestInit.body)).toEqual({
      model: 'qwen2.5:3b',
      prompt: 'prompt',
      stream: false,
      format: 'json',
      options: { num_predict: 40, temperature: 0, top_k: 10 },
    });
  });

  it('sends embedding requests to Ollama', async () => {
    const { createOllamaClient } = await importOllama();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ embeddings: [[1, 2, 3]] }) });
    vi.stubGlobal('fetch', fetchMock);

    await createOllamaClient('http://ollama.test').embed({
      model: 'mxbai-embed-large',
      input: ['query'],
      keep_alive: '10m',
    });

    expect(fetchMock).toHaveBeenCalledWith('http://ollama.test/api/embed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'mxbai-embed-large', input: ['query'], keep_alive: '10m' }),
    });
  });

  it('preserves keep_alive when sending requests to Ollama', async () => {
    const { createOllamaClient } = await importOllama();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: '[]' }) });
    vi.stubGlobal('fetch', fetchMock);

    await createOllamaClient('http://ollama.test').generate({
      model: 'qwen2.5:3b',
      prompt: 'prompt',
      options: { num_predict: 40 },
      keep_alive: '10m',
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(requestInit.body)).toEqual({
      model: 'qwen2.5:3b',
      prompt: 'prompt',
      stream: false,
      options: { num_predict: 40 },
      keep_alive: '10m',
    });
  });

  it('preserves the system prompt when sending requests to Ollama', async () => {
    const { createOllamaClient } = await importOllama();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: '[]' }) });
    vi.stubGlobal('fetch', fetchMock);

    await createOllamaClient('http://ollama.test').generate({
      model: 'llama3.1:8b',
      system: 'system prompt',
      prompt: 'user prompt',
      options: { num_predict: 40 },
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(requestInit.body)).toEqual({
      model: 'llama3.1:8b',
      system: 'system prompt',
      prompt: 'user prompt',
      stream: false,
      options: { num_predict: 40 },
    });
  });

  it('times out Ollama connection validation', async () => {
    const { validateOllamaConnection } = await importOllama();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'qwen2.5:14b' }, { name: 'mxbai-embed-large' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await validateOllamaConnection();

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:11434/api/tags', {
      signal: expect.any(AbortSignal),
    });
  });

  it('accepts an installed latest tag for an untagged configured model', async () => {
    const { validateOllamaConnection } = await importOllama({
      model: 'qwen2.5',
      embeddingModel: 'mxbai-embed-large',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'qwen2.5:latest' }, { name: 'mxbai-embed-large:latest' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(validateOllamaConnection()).resolves.toBeUndefined();
  });

  it('does not match a different tag when the configured model has an explicit tag', async () => {
    const { validateOllamaConnection } = await importOllama({
      model: 'qwen2.5:14b',
      embeddingModel: 'mxbai-embed-large:v1',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'qwen2.5:14b' }, { name: 'mxbai-embed-large:latest' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(validateOllamaConnection()).rejects.toThrow('Ollama embedding model "mxbai-embed-large:v1"');
  });
});
