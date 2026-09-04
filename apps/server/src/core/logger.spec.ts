import { getArgv } from './argv/argv';
import { debugLog, errorLog, infoLog } from './logger';
import { logIncomingRequest } from './main';
import { FOLDERS } from './main-const';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@server/core/argv/argv', () => ({
  getArgv: vi.fn(),
}));

describe('logger', () => {
  let tempDir: string;
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `logger-${Date.now()}`);
    mkdirSync(path.join(tempDir, FOLDERS.logs), { recursive: true });
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
    if (originalLogLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = originalLogLevel;
  });

  it('writes info logs and echoes when debug is true', async () => {
    (getArgv as Mock).mockReturnValue({ dataFolder: tempDir, debug: true });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await infoLog('hello world');

    const logFiles = readFileSync(
      path.join(tempDir, FOLDERS.logs, `log-${new Date().toISOString().slice(0, 10)}.txt`),
      { encoding: 'utf-8' }
    );
    expect(logFiles).toMatch(/\[ info \]\[ \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \] hello world/);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[ info \]\[ \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \] hello world/)
    );
  });

  it('skips debug logs when debug flag is false', async () => {
    (getArgv as Mock).mockReturnValue({ dataFolder: tempDir, debug: false, metadataServiceUrl: '' });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await debugLog('hidden');

    expect(consoleSpy).not.toHaveBeenCalled();
    const logPath = path.join(tempDir, FOLDERS.logs, `log-${new Date().toISOString().slice(0, 10)}.txt`);
    expect(existsSync(logPath)).toBe(false);
  });

  it('writes error logs', async () => {
    (getArgv as Mock).mockReturnValue({ dataFolder: tempDir, debug: false, metadataServiceUrl: '' });

    await errorLog('boom');

    const logFiles = readFileSync(
      path.join(tempDir, FOLDERS.logs, `log-${new Date().toISOString().slice(0, 10)}.txt`),
      { encoding: 'utf-8' }
    );
    expect(logFiles).toMatch(/\[ error \]\[ \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \] boom/);
  });

  it('echoes debug logs when LOG_LEVEL is DEBUG even without debug flag', async () => {
    (getArgv as Mock).mockReturnValue({ dataFolder: tempDir, debug: false, metadataServiceUrl: '' });
    process.env.LOG_LEVEL = 'DEBUG';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await debugLog('env-debug');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[ debug \]\[ \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \] env-debug/)
    );
    const logFiles = readFileSync(
      path.join(tempDir, FOLDERS.logs, `log-${new Date().toISOString().slice(0, 10)}.txt`),
      { encoding: 'utf-8' }
    );
    expect(logFiles).toMatch(/\[ debug \]\[ \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \] env-debug/);
  });

  it('echoes info logs when LOG_LEVEL is DEBUG even without debug flag', async () => {
    (getArgv as Mock).mockReturnValue({ dataFolder: tempDir, debug: false, metadataServiceUrl: '' });
    process.env.LOG_LEVEL = 'debug';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await infoLog('info via env');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[ info \]\[ \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \] info via env/)
    );
  });

  it('logs request pathname without query values', async () => {
    (getArgv as Mock).mockReturnValue({ dataFolder: tempDir, debug: true });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await logIncomingRequest({ url: '/api/v1/collection-items?query=secret&type=movie' });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Incoming request: /api/v1/collection-items'));
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('secret'));
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('?query='));
  });
});
