import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendFile } from 'fs/promises';
import { join } from 'path';
import { errorLog } from './logger';

const options = vi.hoisted(() => ({ dataFolder: 'test-data', debug: false }));
vi.mock('./argv', () => ({ getArgv: () => options }));
vi.mock('fs/promises', () => ({ appendFile: vi.fn(), mkdir: vi.fn() }));

describe('metadata provider logger', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    options.debug = false;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T06:00:00Z'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('writes labelled logs to metadata-provider-YYYY-MM-DD.txt', async () => {
    await errorLog('failed');
    expect(appendFile).toHaveBeenCalledWith(
      join('test-data', 'logs', 'metadata-provider-2026-09-15.txt'),
      '[ error ][ 2026-09-15T06:00:00.000Z ][ metadata-provider ] failed\n',
      'utf8'
    );
  });
});
