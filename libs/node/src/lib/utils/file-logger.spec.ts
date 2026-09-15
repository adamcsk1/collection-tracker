import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createFileLogger } from './file-logger';

vi.mock('fs/promises', () => ({ appendFile: vi.fn(), mkdir: vi.fn() }));

describe('createFileLogger', () => {
  const options = { dataFolder: 'test-data', debug: false };

  beforeEach(() => {
    vi.resetAllMocks();
    options.debug = false;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T06:00:00Z'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const logger = (label?: string) =>
    createFileLogger({
      getDataFolder: () => options.dataFolder,
      isDebugEnabled: () => options.debug,
      filePrefix: label ? 'metadata-provider' : 'log',
      ...(label ? { label } : {}),
    });

  it('persists info, warning, and error logs when debug is disabled', async () => {
    const { infoLog, warningLog, errorLog, debugLog } = logger();
    await infoLog('ready');
    await warningLog('slow');
    await errorLog('failed\nsecond line');
    await debugLog('hidden');
    expect(mkdir).toHaveBeenCalledWith(join('test-data', 'logs'), { recursive: true });
    expect(appendFile).toHaveBeenCalledTimes(3);
    expect(appendFile).toHaveBeenNthCalledWith(
      1,
      join('test-data', 'logs', 'log-2026-09-15.txt'),
      '[ info ][ 2026-09-15T06:00:00.000Z ] ready\n',
      'utf8'
    );
    expect(appendFile).toHaveBeenLastCalledWith(
      join('test-data', 'logs', 'log-2026-09-15.txt'),
      '[ error ][ 2026-09-15T06:00:00.000Z ] failed second line\n',
      'utf8'
    );
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('includes an optional service label and file prefix', async () => {
    const { errorLog } = logger('metadata-provider');
    await errorLog('failed');
    expect(appendFile).toHaveBeenCalledWith(
      join('test-data', 'logs', 'metadata-provider-2026-09-15.txt'),
      '[ error ][ 2026-09-15T06:00:00.000Z ][ metadata-provider ] failed\n',
      'utf8'
    );
  });

  it('echoes info, warning, and debug logs when debug is enabled', async () => {
    options.debug = true;
    const { infoLog, warningLog, debugLog } = logger();
    await infoLog('ready');
    await warningLog('slow');
    await debugLog('request completed');
    expect(console.log).toHaveBeenCalledTimes(3);
    expect(appendFile).toHaveBeenCalledTimes(3);
  });

  it('does not propagate directory or file write failures', async () => {
    vi.mocked(mkdir).mockRejectedValueOnce(new Error('permission denied'));
    await expect(logger().errorLog('failure')).resolves.toBeUndefined();
    vi.mocked(appendFile).mockRejectedValueOnce(new Error('disk full'));
    await expect(logger().infoLog('ready')).resolves.toBeUndefined();
  });
});
