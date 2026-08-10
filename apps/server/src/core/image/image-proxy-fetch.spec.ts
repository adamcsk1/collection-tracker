import { EventEmitter } from 'node:events';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getArgv } from '../argv/argv';

const requestState = vi.hoisted(() => ({
  responses: [] as Array<{
    statusCode: number;
    contentType?: string;
    contentLength?: number;
    location?: string;
    body?: string;
  }>,
}));

vi.mock('dns/promises', () => ({ lookup: vi.fn(async () => [{ address: '8.8.8.8', family: 4 }]) }));
vi.mock('../argv/argv', () => ({ getArgv: vi.fn() }));

const requestMockFactory = () =>
  vi.fn(
    (
      _options: unknown,
      callback: (
        response: Readable & {
          statusCode?: number;
          headers: Record<string, string | string[] | undefined>;
          resume: () => void;
        }
      ) => void
    ) => {
      const clientRequest = new EventEmitter() as EventEmitter & { end: () => void; destroy: (error: Error) => void };
      clientRequest.end = () => {
        const configured = requestState.responses.shift()!;
        const response = Readable.from([configured.body ?? 'image']) as Readable & {
          statusCode?: number;
          headers: Record<string, string | string[] | undefined>;
          resume: () => void;
        };
        response.statusCode = configured.statusCode;
        response.headers = {
          'content-type': configured.contentType,
          'content-length': configured.contentLength === undefined ? undefined : `${configured.contentLength}`,
          location: configured.location,
        };
        callback(response);
      };
      clientRequest.destroy = (error) => clientRequest.emit('error', error);
      return clientRequest;
    }
  );

vi.mock('http', () => ({ request: requestMockFactory() }));
vi.mock('https', () => ({ request: requestMockFactory() }));

describe('image-proxy fetch responses', () => {
  let temporaryDataFolder: string;

  beforeEach(() => {
    temporaryDataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    vi.mocked(getArgv).mockReturnValue({ dataFolder: temporaryDataFolder, debug: false });
    requestState.responses = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
    rmSync(temporaryDataFolder, { force: true, recursive: true });
  });

  it.each([
    [
      { statusCode: 404, contentType: 'image/jpeg' },
      { kind: 'upstream-error', statusCode: 404 },
    ],
    [{ statusCode: 200, contentType: 'text/plain' }, { kind: 'not-image' }],
    [{ statusCode: 200, contentType: 'image/jpeg', contentLength: 50_000_001 }, { kind: 'too-large' }],
  ] as const)('handles non-cacheable upstream responses', async (response, expected) => {
    requestState.responses.push(response);
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    expect(
      await fetchAndCacheImageWithDetails(`http://images.example/${response.statusCode}-${response.contentType}`)
    ).toEqual(expected);
  });

  it('follows a safe relative redirect', async () => {
    requestState.responses.push(
      { statusCode: 302, contentType: 'text/plain', location: '/poster.jpg' },
      { statusCode: 200, contentType: 'image/jpeg', body: 'jpeg' }
    );
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    expect(await fetchAndCacheImageWithDetails('http://images.example/redirect')).toEqual({
      kind: 'fetched',
    });
    expect(readdirSync(join(temporaryDataFolder, 'cache'))).toHaveLength(2);
  });

  it.each([
    [{ statusCode: 302, contentType: 'text/plain' }, { kind: 'redirect' }],
    [{ statusCode: 302, contentType: 'text/plain', location: 'file:///poster.jpg' }, { kind: 'invalid-url' }],
    [{ statusCode: 302, contentType: 'text/plain', location: 'http://localhost/poster.jpg' }, { kind: 'blocked' }],
  ] as const)('rejects unsafe redirects', async (response, expected) => {
    requestState.responses.push(response);
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    const location = 'location' in response ? response.location : 'missing';
    expect(await fetchAndCacheImageWithDetails(`http://images.example/redirect-${location}`)).toEqual(expected);
  });
});
