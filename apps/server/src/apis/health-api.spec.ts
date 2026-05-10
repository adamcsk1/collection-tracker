import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));
vi.mock('node:os', () => ({ cpus: vi.fn(), totalmem: vi.fn(), freemem: vi.fn(), loadavg: vi.fn() }));
vi.mock('node:fs', () => ({ statfsSync: vi.fn() }));
vi.mock('../core/ollama/ollama', () => ({ validateOllamaConnection: vi.fn().mockResolvedValue(undefined) }));

const makeCpu = (times: { user: number; nice: number; sys: number; idle: number; irq: number }) => ({
  model: 'Test CPU',
  speed: 0,
  times,
});

describe('health-api', () => {
  const defaultCpu = makeCpu({ user: 0, nice: 0, sys: 0, idle: 1000, irq: 0 });

  beforeEach(async () => {
    const { validateOllamaConnection } = await import('../core/ollama/ollama');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ body: { cancel: vi.fn().mockResolvedValue(undefined) } }));
    vi.mocked(validateOllamaConnection).mockResolvedValue(undefined);
    (os.cpus as Mock).mockReturnValue([defaultCpu]);
    (os.totalmem as Mock).mockReturnValue(8_000_000_000);
    (os.freemem as Mock).mockReturnValue(4_000_000_000); // 50% used
    (os.loadavg as Mock).mockReturnValue([0.5, 0.4, 0.3]);
    (fs.statfsSync as Mock).mockReturnValue({ blocks: 1000, bavail: 500, bsize: 4096 }); // 50% used
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('responds with ok when all metrics are healthy', async () => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({}, response);

    const { register } = await import('./health-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));
  });

  it('responds with warn when memory exceeds 80%', async () => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({}, response);
    (os.freemem as Mock).mockReturnValue(1_000_000_000); // ~87.5% used

    const { register } = await import('./health-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ status: 'warn' }));
  });

  it('responds with error when memory exceeds 95%', async () => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({}, response);
    (os.freemem as Mock).mockReturnValue(200_000_000); // ~97.5% used

    const { register } = await import('./health-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
  });

  it('responds with error when frontend is down', async () => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({}, response);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const { register } = await import('./health-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', frontend: { status: 'down' } })
    );
  });

  it('keeps overall health ok when only AI is down', async () => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({}, response);
    const { validateOllamaConnection } = await import('../core/ollama/ollama');
    vi.mocked(validateOllamaConnection).mockRejectedValue(new Error('Ollama unavailable'));

    const { register } = await import('./health-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok', ai: { status: 'down' } }));
  });

  it('uses HEALTH_CHECK_URL when checking frontend status', async () => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({}, response);
    vi.stubEnv('HEALTH_CHECK_URL', 'http://127.0.0.1:3001/collection-tracker/');

    const { register } = await import('./health-api');
    register(app);
    await handlerPromise();

    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3001/collection-tracker/', expect.any(Object));
  });

  it('calculates memory and cpu usage percentages correctly', async () => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({}, response);
    const startCpu = makeCpu({ user: 0, nice: 0, sys: 0, idle: 1000, irq: 0 });
    const endCpu = makeCpu({ user: 100, nice: 0, sys: 0, idle: 1100, irq: 0 });
    (os.cpus as Mock).mockReturnValueOnce([startCpu]).mockReturnValueOnce([endCpu]);
    (os.freemem as Mock).mockReturnValue(4_000_000_000); // 50% of 8 GB used

    const { register } = await import('./health-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        memory: { usedPercent: 50 },
        cpu: { usagePercent: 50 },
      })
    );
  });

  it('sets disk to null when statfsSync throws', async () => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({}, response);
    (fs.statfsSync as Mock).mockImplementation(() => {
      throw new Error('not supported');
    });

    const { register } = await import('./health-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ disk: null }));
  });

  it('rounds load averages to 2 decimal places', async () => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({}, response);
    (os.loadavg as Mock).mockReturnValue([1.234, 0.567, 0.891]);

    const { register } = await import('./health-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({ load: { avg1m: 1.23, avg5m: 0.57, avg15m: 0.89 } })
    );
  });
});
