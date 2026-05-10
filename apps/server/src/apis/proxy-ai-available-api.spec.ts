import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/ollama/ollama', () => ({
  validateOllamaConnection: vi.fn(() => Promise.resolve()),
}));

describe('proxy-ai-available-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns aiAvailable true when Ollama is reachable', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./proxy-ai-available-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ aiAvailable: true });
  });

  it('returns aiAvailable false when Ollama is unavailable', async () => {
    const { validateOllamaConnection } = await import('../core/ollama/ollama');
    vi.mocked(validateOllamaConnection).mockRejectedValueOnce(new Error('Ollama unavailable'));
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./proxy-ai-available-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ aiAvailable: false });
  });
});
