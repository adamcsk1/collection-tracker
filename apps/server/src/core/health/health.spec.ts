import * as fs from 'node:fs';
import * as os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));
vi.mock('node:os', () => ({ cpus: vi.fn(), totalmem: vi.fn(), freemem: vi.fn(), loadavg: vi.fn() }));
vi.mock('node:fs', () => ({ statfsSync: vi.fn() }));
vi.mock('../argv/argv', () => ({ getArgv: vi.fn().mockReturnValue({ dataFolder: '/data', debug: false }) }));
vi.mock('../ollama/ollama', () => ({ validateOllamaConnection: vi.fn().mockResolvedValue(undefined) }));

const makeCpu = (times: { user: number; nice: number; sys: number; idle: number; irq: number }) => ({
  model: 'Test CPU',
  speed: 0,
  times,
});

const healthyCpu = makeCpu({ user: 0, nice: 0, sys: 0, idle: 1000, irq: 0 });

describe('health', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { validateOllamaConnection } = await import('../ollama/ollama');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, body: { cancel: vi.fn().mockResolvedValue(undefined) } })
    );
    vi.mocked(validateOllamaConnection).mockResolvedValue(undefined);
    (os.cpus as Mock).mockReturnValue([healthyCpu]);
    (os.totalmem as Mock).mockReturnValue(1000);
    (os.freemem as Mock).mockReturnValue(500);
    (os.loadavg as Mock).mockReturnValue([1.234, 0.567, 0.891]);
    (fs.statfsSync as Mock).mockReturnValue({ blocks: 1000, bavail: 500, bsize: 4096 });
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('collects and rounds resource and dependency diagnostics', async () => {
    const startCpu = makeCpu({ user: 0, nice: 0, sys: 0, idle: 1000, irq: 0 });
    const endCpu = makeCpu({ user: 100, nice: 0, sys: 0, idle: 1100, irq: 0 });
    (os.cpus as Mock).mockReturnValueOnce([startCpu]).mockReturnValueOnce([endCpu]);
    vi.stubEnv('HEALTH_CHECK_URL', 'http://127.0.0.1:3001/collection-tracker/');

    const { getHealth } = await import('./health');

    await expect(getHealth()).resolves.toEqual({
      status: 'ok',
      memory: { usedPercent: 50 },
      cpu: { usagePercent: 50 },
      disk: { usedPercent: 50 },
      load: { avg1m: 1.23, avg5m: 0.57, avg15m: 0.89 },
      frontend: { status: 'up' },
      ai: { status: 'up' },
    });
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3001/collection-tracker/', expect.any(Object));
    expect(fs.statfsSync).toHaveBeenCalledWith('/data');
  });

  it.each([
    ['memory', 81, 'warn'],
    ['memory', 96, 'error'],
    ['cpu', 81, 'warn'],
    ['cpu', 96, 'error'],
    ['disk', 81, 'warn'],
    ['disk', 96, 'error'],
  ] as const)('returns %s threshold %i as %s', async (metric, usedPercent, expectedStatus) => {
    if (metric === 'memory') (os.freemem as Mock).mockReturnValue(1000 - usedPercent * 10);
    if (metric === 'cpu') {
      (os.cpus as Mock)
        .mockReturnValueOnce([makeCpu({ user: 0, nice: 0, sys: 0, idle: 0, irq: 0 })])
        .mockReturnValueOnce([makeCpu({ user: usedPercent, nice: 0, sys: 0, idle: 100 - usedPercent, irq: 0 })]);
    }
    if (metric === 'disk') {
      (fs.statfsSync as Mock).mockReturnValue({ blocks: 100, bavail: 100 - usedPercent, bsize: 1 });
    }

    const { getHealth } = await import('./health');

    await expect(getHealth()).resolves.toEqual(expect.objectContaining({ status: expectedStatus }));
  });

  it('reports frontend failures as an overall error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));
    const { getHealth } = await import('./health');

    await expect(getHealth()).resolves.toEqual(
      expect.objectContaining({ status: 'error', frontend: { status: 'down' } })
    );
  });

  it('cancels unsuccessful frontend responses and reports them down', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, body: { cancel } }));
    const { getHealth } = await import('./health');

    await expect(getHealth()).resolves.toEqual(
      expect.objectContaining({ status: 'error', frontend: { status: 'down' } })
    );
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('reports disk failures as unavailable without failing overall health', async () => {
    (fs.statfsSync as Mock).mockImplementation(() => {
      throw new Error('not supported');
    });
    const { getHealth } = await import('./health');

    await expect(getHealth()).resolves.toEqual(expect.objectContaining({ status: 'ok', disk: null }));
  });

  it('reports AI failures without failing overall health', async () => {
    const { validateOllamaConnection } = await import('../ollama/ollama');
    vi.mocked(validateOllamaConnection).mockRejectedValue(new Error('Ollama unavailable'));
    const { getHealth } = await import('./health');

    await expect(getHealth()).resolves.toEqual(expect.objectContaining({ status: 'ok', ai: { status: 'down' } }));
  });

  it('coalesces concurrent checks and caches results for five seconds', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    let resolveFetch!: (value: { ok: boolean; body: { cancel: () => Promise<void> } }) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<{ ok: boolean; body: { cancel: () => Promise<void> } }>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );
    const { getHealth } = await import('./health');

    const first = getHealth();
    const second = getHealth();
    expect(fetch).toHaveBeenCalledOnce();
    resolveFetch({ ok: true, body: { cancel: vi.fn().mockResolvedValue(undefined) } });
    await Promise.all([first, second]);

    await getHealth();
    expect(fetch).toHaveBeenCalledOnce();
    expect(os.cpus).toHaveBeenCalledTimes(2);

    vi.mocked(Date.now).mockReturnValue(6001);
    vi.mocked(fetch).mockResolvedValue(new Response());
    await getHealth();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(os.cpus).toHaveBeenCalledTimes(4);
  });
});
