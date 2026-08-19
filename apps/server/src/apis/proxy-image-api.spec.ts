import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { API_PREFIX } from '@shared/constants/api-const';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';

type UpstreamResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer;
};

let upstreamResponses: UpstreamResponse[] = [
  {
    statusCode: 200,
    headers: { 'content-type': 'image/png' },
    body: Buffer.from('image-bytes'),
  },
];

let upstreamRequest: ReturnType<typeof vi.fn>;

const createResponse = () => {
  const response: any = {};
  response.send = vi.fn().mockReturnValue(response);
  response.code = vi.fn().mockReturnValue(response);
  response.header = vi.fn().mockReturnValue(response);
  return response;
};

const importApi = async (dataFolder: string, lookupAddress = '203.0.113.10') => {
  let responseIndex = 0;
  upstreamRequest = vi.fn((_options, callback) => {
    const upstreamResponse = upstreamResponses[Math.min(responseIndex, upstreamResponses.length - 1)];
    responseIndex += 1;
    const response = Readable.from(upstreamResponse.body ? [upstreamResponse.body] : []) as any;
    response.statusCode = upstreamResponse.statusCode;
    response.headers = upstreamResponse.headers;
    response.resume = vi.fn();
    callback(response);

    return {
      destroy: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    };
  });

  vi.doMock('../core/argv/argv', () => ({ getArgv: () => ({ dataFolder, debug: false }) }));
  vi.doMock('dns/promises', () => {
    const lookup = vi.fn(async (hostname: string) => {
      if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        return [{ address: '127.0.0.1', family: 4 }];
      }
      return [{ address: lookupAddress, family: 4 }];
    });
    return { default: { lookup }, lookup };
  });
  vi.doMock('http', () => ({ default: { request: upstreamRequest }, request: upstreamRequest }));
  vi.doMock('https', () => ({ default: { request: upstreamRequest }, request: upstreamRequest }));
  return import('./proxy-image-api');
};

describe('proxy-image-api', () => {
  let dataFolder: string | null = null;

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    upstreamResponses = [
      {
        statusCode: 200,
        headers: { 'content-type': 'image/png' },
        body: Buffer.from('image-bytes'),
      },
    ];
    if (dataFolder) rmSync(dataFolder, { recursive: true, force: true });
    dataFolder = null;
  });

  it('returns 400 when url is missing or unsupported', async () => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    const response = createResponse();
    const request: any = { query: { url: 'file:///tmp/image.png' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await importApi(dataFolder);
    register(app);

    await handlerPromise();
    expect(app.get).toHaveBeenCalledWith(
      `${API_PREFIX}/images/proxy`,
      {
        preHandler: [expect.any(Function), expect.any(Function)],
        config: { rateLimit: { max: 240, timeWindow: '1 minute', groupId: 'image' } },
      },
      expect.any(Function)
    );
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('fetches an image once and serves cached bytes on the next request', async () => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    const image = Buffer.from('image-bytes');

    const { register } = await importApi(dataFolder);
    const request: any = { query: { url: 'https://images.example/poster.png' } };
    const firstResponse = createResponse();
    const firstApp = buildApp(request, firstResponse);
    register(firstApp.app);

    await firstApp.handlerPromise();
    expect(upstreamRequest).toHaveBeenCalledTimes(1);
    expect(upstreamRequest).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: '203.0.113.10', family: 4, servername: 'images.example' }),
      expect.any(Function)
    );
    expect(firstResponse.header).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(firstResponse.send).toHaveBeenCalledWith(image);

    const secondResponse = createResponse();
    const secondApp = buildApp(request, secondResponse);
    register(secondApp.app);

    await secondApp.handlerPromise();
    expect(upstreamRequest).toHaveBeenCalledTimes(1);
    expect(secondResponse.send).toHaveBeenCalledWith(image);

    expect(readdirSync(join(dataFolder, 'cache')).sort()).toHaveLength(2);
  });

  it('follows public redirects and caches under the original source url', async () => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    const image = Buffer.from('redirected-image');
    upstreamResponses = [
      {
        statusCode: 302,
        headers: { location: 'https://cdn.example/cover.jpg' },
        body: Buffer.from(''),
      },
      {
        statusCode: 200,
        headers: { 'content-type': 'image/jpeg' },
        body: image,
      },
    ];
    const response = createResponse();
    const request: any = {
      query: { url: 'https://covers.openlibrary.org/b/id/13430209-M.jpg?default=false' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await importApi(dataFolder);
    register(app);

    await handlerPromise();
    expect(upstreamRequest).toHaveBeenCalledTimes(2);
    expect(upstreamRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: '/b/id/13430209-M.jpg?default=false',
        servername: 'covers.openlibrary.org',
      }),
      expect.any(Function)
    );
    expect(upstreamRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: '/cover.jpg', servername: 'cdn.example' }),
      expect.any(Function)
    );
    expect(response.header).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(response.send).toHaveBeenCalledWith(image);
  });

  it('rejects redirects that target private hosts', async () => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    upstreamResponses = [
      {
        statusCode: 302,
        headers: { location: 'http://127.0.0.1/secret.png' },
        body: Buffer.from(''),
      },
    ];
    const response = createResponse();
    const request: any = { query: { url: 'https://images.example/poster.png' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await importApi(dataFolder);
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects redirect chains that exceed the hop limit', async () => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    upstreamResponses = Array.from({ length: 6 }, (_, index) => ({
      statusCode: 302,
      headers: { location: `https://cdn.example/hop-${index + 1}.jpg` },
      body: Buffer.from(''),
    }));
    const response = createResponse();
    const request: any = { query: { url: 'https://images.example/poster.png' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await importApi(dataFolder);
    register(app);

    await handlerPromise();
    expect(upstreamRequest).toHaveBeenCalledTimes(6);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects non-image responses', async () => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    upstreamResponses = [{ statusCode: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from('html') }];
    const response = createResponse();
    const request: any = { query: { url: 'https://images.example/poster' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await importApi(dataFolder);
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(415);
  });

  it.each([404, 429, 503])('returns 502 when the upstream responds with %i', async (statusCode) => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    upstreamResponses = [{ statusCode, headers: {}, body: Buffer.from('') }];
    const response = createResponse();
    const request: any = { query: { url: 'https://images.example/poster.png' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await importApi(dataFolder);
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(502);
  });

  it('rejects localhost and private network targets', async () => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    const localhostResponse = createResponse();
    const localhostApp = buildApp({ query: { url: 'http://localhost/poster.png' } }, localhostResponse);

    const { register } = await importApi(dataFolder);
    register(localhostApp.app);

    await localhostApp.handlerPromise();
    expect(localhostResponse.code).toHaveBeenCalledWith(400);

    const privateResponse = createResponse();
    const privateApp = buildApp({ query: { url: 'http://192.168.1.10/poster.png' } }, privateResponse);
    register(privateApp.app);

    await privateApp.handlerPromise();
    expect(privateResponse.code).toHaveBeenCalledWith(400);
  });

  it('rejects oversized image responses before caching', async () => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    upstreamResponses = [
      {
        statusCode: 200,
        headers: { 'content-type': 'image/png', 'content-length': `${10 * 1024 * 1024 + 1}` },
        body: Buffer.from(''),
      },
    ];
    const response = createResponse();
    const request: any = { query: { url: 'https://images.example/poster.png' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await importApi(dataFolder);
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(413);
  });

  it('returns 503 with retry guidance when the image fetch queue is busy', async () => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    vi.doMock('../core/image/image-proxy', () => ({
      fetchAndCacheImageWithDetails: vi.fn(async () => ({ kind: 'busy' })),
      getCachedImage: vi.fn(() => null),
    }));
    const response = createResponse();
    const request: any = { query: { url: 'https://images.example/poster.png' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await importApi(dataFolder);
    register(app);

    await handlerPromise();
    expect(response.header).toHaveBeenCalledWith('Retry-After', 10);
    expect(response.code).toHaveBeenCalledWith(503);
  });
});
