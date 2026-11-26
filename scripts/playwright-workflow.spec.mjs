import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const workflow = load(readFileSync('.github/workflows/playwright.yml', 'utf8'));

const listTests = (...filters) => {
  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'node_modules/@playwright/test/cli.js',
        'test',
        '--config=apps/collection-e2e/playwright.config.ts',
        '--project=chromium',
        '--list',
        '--reporter=json',
        ...filters,
      ],
      { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    )
  );
  const collect = (suite) => [
    ...(suite.specs ?? []).map((spec) => ({ id: spec.id, title: spec.title, file: spec.file })),
    ...(suite.suites ?? []).flatMap(collect),
  ];
  return report.suites.flatMap(collect);
};

describe('Playwright CI workflow', () => {
  it('assigns every test exactly once and keeps health contrast with accessibility', () => {
    const selection = workflow.env.ACCESSIBILITY_TESTS;
    const all = listTests();
    const accessibility = listTests('--grep', selection);
    const functional = workflow.jobs.playwright.strategy.matrix.suite
      .filter((suite) => suite.shard)
      .flatMap((suite) => listTests('--grep-invert', selection, `--shard=${suite.shard}`));
    const selected = [...accessibility, ...functional].map((test) => test.id);
    expect(accessibility.length).toBeGreaterThan(0);
    expect(functional.length).toBeGreaterThan(0);
    expect(new Set(selected).size).toBe(selected.length);
    expect(selected.toSorted()).toEqual(all.map((test) => test.id).toSorted());
    expect(accessibility.some((test) => test.title.includes('diagnostics contrast meets WCAG'))).toBe(true);
    expect(functional.some((test) => test.file.startsWith('accessibility'))).toBe(false);
  }, 120000);
});
