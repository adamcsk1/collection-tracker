import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it, vi } from 'vitest';

const workflow = load(readFileSync('.github/workflows/release.yml', 'utf8'));
const gate = workflow.jobs.release.steps.find((step) => step.id === 'gate').with.script;
const sha = 'a'.repeat(40);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function runGate({
  channel = 'snapshot',
  tags = [],
  tip = sha,
  failedCheck,
  dockerSkipped = false,
  eventName = 'workflow_run',
  title = `Docker GHCR ${sha}`,
} = {}) {
  const outputs = {};
  const core = {
    setOutput: (name, value) => {
      outputs[name] = value;
    },
    notice: vi.fn(),
    setFailed: vi.fn(),
  };
  const github = {
    rest: {
      git: { listMatchingRefs: 'tags', getTag: vi.fn() },
      repos: {
        getContent: async () => ({
          data: { content: Buffer.from('{"version":"1.2.3"}').toString('base64'), encoding: 'base64' },
        }),
        get: async () => ({ data: { default_branch: 'main' } }),
        getBranch: async () => ({ data: { commit: { sha: tip } } }),
      },
      actions: {
        listWorkflowRunsForRepo: 'checks',
        listWorkflowRuns: 'docker',
        listJobsForWorkflowRun: async () => ({
          data: {
            jobs: [
              {
                steps: [
                  { name: 'Build and push Docker image', conclusion: 'success' },
                  {
                    name: 'Build and push metadata-provider Docker image',
                    conclusion: dockerSkipped ? 'skipped' : 'success',
                  },
                ],
              },
            ],
          },
        }),
      },
    },
    paginate: async (method) => {
      if (method === 'tags') return tags.map((tag) => ({ ref: `refs/tags/${tag}`, object: { sha, type: 'commit' } }));
      if (method === 'docker')
        return [
          { id: 12, display_title: title, head_sha: 'wrong-workflow-sha', status: 'completed', conclusion: 'success' },
        ];
      return ['Android', 'Cypress', 'Format', 'i18n', 'Lint', 'Test', 'Typecheck'].map((name) => ({
        name,
        head_sha: sha,
        status: 'completed',
        conclusion: name === failedCheck ? 'failure' : 'success',
      }));
    },
  };
  const context = {
    repo: { owner: 'test', repo: 'collection-tracker' },
    eventName,
    sha: eventName === 'workflow_run' ? 'wrong-context-sha' : sha,
    ref: 'refs/heads/main',
    payload: { workflow_run: { id: 12, display_title: title, head_sha: 'wrong-workflow-sha' } },
  };
  await new AsyncFunction('github', 'context', 'core', gate.replace('${{ matrix.channel }}', channel))(
    github,
    context,
    core
  );
  return { outputs, core };
}

describe('release workflow gate', () => {
  it('accepts untagged snapshot using Docker build SHA rather than workflow context', async () => {
    expect((await runGate()).outputs).toMatchObject({ ready: 'true', tag: 'snapshot', sha });
  });
  it('publishes both channels on matching tagged commits', async () => {
    for (const channel of ['snapshot', 'stable']) {
      expect((await runGate({ channel, tags: ['v1.2.3'] })).outputs).toMatchObject({
        ready: 'true',
        tag: channel === 'snapshot' ? 'snapshot' : 'v1.2.3',
      });
    }
  });
  it.each([
    { channel: 'stable' },
    { channel: 'stable', tags: ['v9.9.9'] },
    { tip: 'newer' },
    { failedCheck: 'Cypress' },
    { dockerSkipped: true },
    { title: 'legacy run without SHA' },
  ])('does not build when gate requirements fail: %j', async (options) => {
    expect((await runGate(options)).outputs.ready).toBe('false');
  });
  it('supports manual snapshots and finds Docker provenance independently of workflow head_sha', async () => {
    expect((await runGate({ eventName: 'workflow_dispatch' })).outputs.ready).toBe('true');
    const stable = await runGate({ channel: 'stable', eventName: 'workflow_dispatch' });
    expect(stable.outputs.ready).toBe('false');
    expect(stable.core.setFailed).not.toHaveBeenCalled();
  });
  it('serializes non-cancelled publication and checks out gated SHA', () => {
    expect(workflow.concurrency).toEqual({ group: 'release-publisher', 'cancel-in-progress': false });
    expect(workflow.jobs.release.steps.find((step) => step.name === 'Checkout').with.ref).toBe(
      '${{ steps.gate.outputs.sha }}'
    );
    const docker = load(readFileSync('.github/workflows/docker-ghcr.yml', 'utf8'));
    expect(docker['run-name']).toBe('Docker GHCR ${{ github.event.workflow_run.head_sha || github.sha }}');
  });
});
