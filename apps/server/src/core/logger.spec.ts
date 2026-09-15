import { getArgv } from './argv/argv';
import { infoLog } from './logger';
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

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `logger-${Date.now()}`);
    mkdirSync(path.join(tempDir, FOLDERS.logs), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('writes unlabeled logs to log-YYYY-MM-DD.txt', async () => {
    (getArgv as Mock).mockReturnValue({ dataFolder: tempDir, debug: true });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await infoLog('hello world');

    const logFiles = readFileSync(
      path.join(tempDir, FOLDERS.logs, `log-${new Date().toISOString().slice(0, 10)}.txt`),
      { encoding: 'utf-8' }
    );
    expect(logFiles).toMatch(/\[ info \]\[ \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \] hello world/);
    expect(logFiles).not.toContain('[ metadata-provider ]');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[ info \]\[ \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \] hello world/)
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
