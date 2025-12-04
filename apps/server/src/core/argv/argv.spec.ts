import { getArgv } from '@server/core/argv/argv';

describe('getArgv', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('returns defaults when no flags are provided', () => {
    process.argv = ['node', 'script'];

    expect(getArgv()).toEqual({ dataFolder: '.data', debug: false });
  });

  it('parses dataFolder and debug flags', () => {
    process.argv = ['node', 'script', '--dataFolder=/tmp/data', '--debug=true'];

    expect(getArgv()).toEqual({ dataFolder: '/tmp/data', debug: true });
  });
});
