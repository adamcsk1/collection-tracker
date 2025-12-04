import { getArgv } from '@server/core/argv/argv';
import { debugLog, errorLog, infoLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

jest.mock('@server/core/argv/argv', () => ({
  getArgv: jest.fn(),
}));

describe('logger', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `logger-${Date.now()}`);
    mkdirSync(path.join(tempDir, FOLDERS.logs), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('writes info logs and echoes when debug is true', () => {
    (getArgv as jest.Mock).mockReturnValue({ dataFolder: tempDir, debug: true });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    infoLog('hello world');

    const logFiles = readFileSync(
      path.join(tempDir, FOLDERS.logs, `log-${new Date().toISOString().slice(0, 10)}.txt`),
      { encoding: 'utf-8' }
    );
    expect(logFiles).toContain('[ info ] hello world');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ info ] hello world'));
  });

  it('skips debug logs when debug flag is false', () => {
    (getArgv as jest.Mock).mockReturnValue({ dataFolder: tempDir, debug: false });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    debugLog('hidden');

    expect(consoleSpy).not.toHaveBeenCalled();
    const logPath = path.join(tempDir, FOLDERS.logs, `log-${new Date().toISOString().slice(0, 10)}.txt`);
    expect(existsSync(logPath)).toBe(false);
  });

  it('writes error logs', () => {
    (getArgv as jest.Mock).mockReturnValue({ dataFolder: tempDir, debug: false });

    errorLog('boom');

    const logFiles = readFileSync(
      path.join(tempDir, FOLDERS.logs, `log-${new Date().toISOString().slice(0, 10)}.txt`),
      { encoding: 'utf-8' }
    );
    expect(logFiles).toContain('[ error ] boom');
  });
});
