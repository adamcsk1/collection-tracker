import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('getArgv', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('returns defaults when no flags are provided', async () => {
    process.argv = ['node', 'script'];
    const { getArgv } = await import('./argv');

    expect(getArgv()).toEqual({ dataFolder: '.data', debug: false, metadataServiceUrl: '' });
  });

  it('parses dataFolder and debug flags', async () => {
    process.argv = [
      'node',
      'script',
      '--dataFolder=/tmp/data',
      '--debug=true',
      '--metadataServiceUrl=http://127.0.0.1:3002',
    ];
    const { getArgv } = await import('./argv');

    expect(getArgv()).toEqual({
      dataFolder: '/tmp/data',
      debug: true,
      metadataServiceUrl: 'http://127.0.0.1:3002',
    });
  });

  it('returns the same object reference on subsequent calls (memoized)', async () => {
    process.argv = ['node', 'script', '--dataFolder=/tmp/data', '--debug=true'];
    const { getArgv } = await import('./argv');

    const first = getArgv();
    process.argv = ['node', 'script', '--dataFolder=/other', '--debug=false'];
    const second = getArgv();

    expect(second).toBe(first);
    expect(second).toEqual({ dataFolder: '/tmp/data', debug: true, metadataServiceUrl: '' });
  });
});
