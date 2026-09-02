import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  createCommandFailureMessage,
  formatBuildDate,
  formatCommand,
  formatHelp,
  parseArguments,
  updateClientAboutBuildInfoSource,
  withClientAboutBuildInfo,
} = require('./create-release.js');

const aboutSource = `export class About {
  protected readonly build = 'localhost-build';
  protected readonly buildDate = 'localhost-build-date';
  protected readonly appVersion = 'localhost-version';
}
`;

describe('create-release build metadata helpers', () => {
  it('updates About build metadata placeholders and escapes TypeScript string values', () => {
    const updatedSource = updateClientAboutBuildInfoSource(aboutSource, {
      build: "abc123 (feature\\branch's)",
      buildDate: '2026-06-15',
      version: '1.2.3',
    });

    expect(updatedSource).toContain("protected readonly build = 'abc123 (feature\\\\branch\\'s)';");
    expect(updatedSource).toContain("protected readonly buildDate = '2026-06-15';");
    expect(updatedSource).toContain("protected readonly appVersion = '1.2.3';");
  });

  it('formats release build dates as YYYY-MM-DD', () => {
    expect(formatBuildDate(new Date('2026-06-15T09:00:00.000Z'))).toBe('2026-06-15');
  });

  it('restores the exact original About source when the release build callback fails', () => {
    const temporaryFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-release-'));
    const temporaryAboutFile = join(temporaryFolder, 'about.ts');
    const customSource = aboutSource.replace('localhost-version', 'local-dev-version');
    writeFileSync(temporaryAboutFile, customSource, 'utf-8');

    try {
      expect(() =>
        withClientAboutBuildInfo(
          temporaryAboutFile,
          {
            build: 'abc123 (main)',
            buildDate: '2026-06-15',
            version: '1.2.3',
          },
          () => {
            expect(readFileSync(temporaryAboutFile, 'utf-8')).toContain("protected readonly appVersion = '1.2.3';");
            throw new Error('build failed');
          }
        )
      ).toThrow('build failed');

      expect(readFileSync(temporaryAboutFile, 'utf-8')).toBe(customSource);
    } finally {
      rmSync(temporaryFolder, { recursive: true, force: true });
    }
  });
});

describe('create-release argument helpers', () => {
  it('prints usage, options, and examples in help output', () => {
    const help = formatHelp();

    expect(help).toContain('Usage:');
    expect(help).toContain('-h, --help');
    expect(help).toContain('npm run release -- --help');
    expect(help).not.toContain('--bump');
  });

  it('parses help options', () => {
    expect(parseArguments(['--help'])).toEqual({ help: true });
    expect(parseArguments(['--', '--help'])).toEqual({ help: true });
    expect(parseArguments([])).toEqual({ help: false });
  });

  it('reports unknown arguments with usage guidance', () => {
    expect(() => parseArguments(['--unknown'])).toThrow('Run npm run release -- --help for usage.');
  });
});

describe('create-release command helpers', () => {
  it('formats command arguments with quotes when needed', () => {
    expect(formatCommand('git', ['commit', '-m', 'chore(release): bump version to 1.2.3'])).toBe(
      'git commit -m "chore(release): bump version to 1.2.3"'
    );
  });

  it('includes the command and working directory in failure messages', () => {
    expect(createCommandFailureMessage('npm', ['run', 'build'], '/repo', 1)).toBe(
      'Command failed with status 1: npm run build\nWorking directory: /repo'
    );
  });
});

