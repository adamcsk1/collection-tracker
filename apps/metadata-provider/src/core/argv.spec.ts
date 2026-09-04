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

    expect(getArgv()).toEqual({ dataFolder: '.data', debug: false });
  });

  it('parses dataFolder and debug flags', async () => {
    process.argv = ['node', 'script', '--dataFolder=/tmp/data', '--debug=true'];
    const { getArgv } = await import('./argv');

    expect(getArgv()).toEqual({ dataFolder: '/tmp/data', debug: true });
  });
});
