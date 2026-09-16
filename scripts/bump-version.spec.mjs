import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { bumpVersion, formatHelp, parseArguments } = require('./bump-version.js');

describe('bump-version argument helpers', () => {
  it('prints usage, options, and examples in help output', () => {
    const help = formatHelp();

    expect(help).toContain('Usage:');
    expect(help).toContain('<major|minor|patch>');
    expect(help).toContain('--no-commit');
    expect(help).toContain('npm run bump-version -- patch');
    expect(help).toContain('npm run bump-version -- minor --no-commit');
  });

  it('parses help and bump options', () => {
    expect(parseArguments(['--help'])).toEqual({ bump: '', help: true, noCommit: false });
    expect(parseArguments(['--', '--help'])).toEqual({ bump: '', help: true, noCommit: false });
    expect(parseArguments(['minor', '--no-commit'])).toEqual({ bump: 'minor', help: false, noCommit: true });
    expect(parseArguments(['patch'])).toEqual({ bump: 'patch', help: false, noCommit: false });
  });

  it('reports missing or unsupported bump values with usage guidance', () => {
    expect(() => parseArguments([])).toThrow('Bump type is required: major, minor, or patch');
    expect(() => parseArguments(['weekly'])).toThrow('Unknown bump-version argument: weekly');
    expect(() => parseArguments(['--unknown'])).toThrow('Run npm run bump-version -- --help for usage.');
    expect(() => parseArguments(['patch', 'minor'])).toThrow('Unknown bump-version argument: minor');
  });
});

describe('bump-version version helpers', () => {
  it('bumps semantic versions', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
  });
});
