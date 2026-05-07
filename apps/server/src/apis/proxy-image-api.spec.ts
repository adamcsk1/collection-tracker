import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { API_PREFIX } from '@shared/constants/api-const';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';

let upstreamResponse = {
  statusCode: 200,
  headers: { 'content-type': 'image/png' } as Record<string, string>,
  body: Buffer.from('image-bytes'),
};

let upstreamRequest: ReturnType<typeof vi.fn>;

const createResponse = () => {
  const response: any = {};
  response.send = vi.fn().mockReturnValue(response);
  response.code = vi.fn().mockReturnValue(response);
  response.header = vi.fn().mockReturnValue(response);
  return response;
};

const importApi = async (dataFolder: string) => {
  upstreamRequest = vi.fn((_options, callback) => {
    const response = Readable.from(upstreamResponse.body ? [upstreamResponse.body] : []) as any;
    response.statusCode = upstreamResponse.statusCode;
    response.headers = upstreamResponse.headers;
    callback(response);

    return {
      destroy: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    };
  });

  vi.doMock('../core/argv/argv', () => ({ getArgv: () => ({ dataFolder, debug: false }) }));
  vi.doMock('dns/promises', () => ({ lookup: vi.fn(async () => [{ address: '203.0.113.10', family: 4 }]) }));
  vi.doMock('http', () => ({ request: upstreamRequest }));
  vi.doMock('https', () => ({ request: upstreamRequest }));
  return import('./proxy-image-api');
};

describe('proxy-image-api', () => {
  let dataFolder: string | null = null;

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    upstreamResponse = {
      statusCode: 200,
      headers: { 'content-type': 'image/png' } as Record<string, string>,
      body: Buffer.from('image-bytes'),
    };
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
      `${API_PREFIX}/proxy/image`,
      { preHandler: expect.any(Function) },
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

  it('rejects non-image responses', async () => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    upstreamResponse = { statusCode: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from('html') };
    const response = createResponse();
    const request: any = { query: { url: 'https://images.example/poster' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await importApi(dataFolder);
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(415);
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
    upstreamResponse = {
      statusCode: 200,
      headers: { 'content-type': 'image/png', 'content-length': `${10 * 1024 * 1024 + 1}` },
      body: Buffer.from(''),
    };
    const response = createResponse();
    const request: any = { query: { url: 'https://images.example/poster.png' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await importApi(dataFolder);
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(413);
  });
});
