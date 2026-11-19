import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHOTO_IMPORT_MAX_BASE64_LENGTH, PHOTO_IMPORT_MAX_BYTES } from '@shared/constants/photo-import-const';

describe('ollama vision', () => {
  let dataFolder: string | null = null;

  const importVision = async (config: unknown = { host: 'http://vision.test/', model: ' vision-model ' }) => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-vision-'));
    if (config !== undefined) {
      writeFileSync(join(dataFolder, 'ollama-vision.config.json'), JSON.stringify(config));
    }
    vi.doMock('../argv/argv', () => ({ getArgv: () => ({ dataFolder }) }));
    return import('./ollama-vision');
  };

  const createPhoto = async () =>
    (
      await sharp({ create: { width: 12, height: 8, channels: 3, background: 'red' } })
        .png()
        .toBuffer()
    ).toString('base64');

  afterEach(() => {
    if (dataFolder) rmSync(dataFolder, { recursive: true, force: true });
    dataFolder = null;
    vi.resetModules();
    vi.doUnmock('../argv/argv');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not create optional configuration when absent', async () => {
    const vision = await importVision();
    rmSync(join(dataFolder!, 'ollama-vision.config.json'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(vision.getOllamaVisionConfig()).toBeNull();
    await expect(vision.getVisionAvailability()).resolves.toEqual({ available: false, reason: 'not-configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes the independent vision host and model and supplies deterministic defaults', async () => {
    const { getOllamaVisionConfig } = await importVision();

    expect(getOllamaVisionConfig()).toEqual({
      host: 'http://vision.test',
      model: 'vision-model',
      options: { temperature: 0, num_predict: 4096 },
    });
  });

  it.each(['10m', 0, -1])('forwards configured keep_alive %j and merges options', async (keepAlive) => {
    const { getOllamaVisionConfig } = await importVision({
      host: 'https://vision.test/prefix/',
      model: 'vision',
      options: { temperature: 0.3, num_thread: 4, flag: true, stop: 'END' },
      keep_alive: keepAlive,
    });

    expect(getOllamaVisionConfig()).toEqual({
      host: 'https://vision.test/prefix',
      model: 'vision',
      options: { temperature: 0.3, num_predict: 4096, num_thread: 4, flag: true, stop: 'END' },
      keep_alive: keepAlive,
    });
  });

  it('accepts identifier-only photos and discards invalid identifiers when a title is readable', async () => {
    const { parseRecognizedTitles } = await importVision();
    expect(
      parseRecognizedTitles(
        {
          titles: [
            { title: '', identifier: 'ISBN-10: 0-441-17271-7' },
            { title: 'Dune', identifier: '9780441172718' },
            { title: 'Dune', identifier: 'tt0133093' },
          ],
        },
        'book'
      )
    ).toEqual({
      titles: [
        { title: '', identifier: '9780441172719', year: null, contributor: null },
        { title: 'Dune', year: null, contributor: null },
        { title: 'Dune', year: null, contributor: null },
      ],
    });
    expect(() => parseRecognizedTitles({ titles: [{ title: '', identifier: '9780441172718' }] }, 'book')).toThrow(
      expect.objectContaining({ statusCode: 502 })
    );
  });

  it.each([
    null,
    [],
    {},
    { host: 'file:///private', model: 'vision' },
    { host: 'http://user:password@vision.test', model: 'vision' },
    { host: 'http://vision.test?token=value', model: 'vision' },
    { host: 'http://vision.test#fragment', model: 'vision' },
    { host: 'http://vision.test', model: ' ' },
    { host: 'http://vision.test', model: 'vision', options: [] },
    { host: 'http://vision.test', model: 'vision', options: { stop: ['END'] } },
    { host: 'http://vision.test', model: 'vision', keep_alive: '' },
    { host: 'http://vision.test', model: 'vision', keep_alive: true },
  ])('rejects invalid configuration %j without probing Ollama', async (config) => {
    const vision = await importVision(config);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(() => vision.getOllamaVisionConfig()).toThrow(expect.objectContaining({ statusCode: 503 }));
    await expect(vision.getVisionAvailability()).resolves.toEqual({ available: false, reason: 'invalid-config' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON configuration', async () => {
    const { getOllamaVisionConfig } = await importVision();
    writeFileSync(join(dataFolder!, 'ollama-vision.config.json'), '{');

    expect(() => getOllamaVisionConfig()).toThrow('Vision configuration is invalid.');
  });

  it.each([
    [200, { capabilities: ['completion', 'vision'] }, { available: true, reason: 'available' }],
    [200, { capabilities: ['completion'] }, { available: false, reason: 'unsupported-model' }],
    [200, null, { available: false, reason: 'unsupported-model' }],
    [404, {}, { available: false, reason: 'unsupported-model' }],
    [500, {}, { available: false, reason: 'unreachable' }],
  ])('checks model capabilities for status %s and body %j', async (status, body, expected) => {
    const { getVisionAvailability } = await importVision();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fetchMock);
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

    await expect(getVisionAvailability()).resolves.toEqual(expected);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://vision.test/api/show',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'vision-model' }),
      })
    );
    expect(timeoutSpy).toHaveBeenCalledWith(3000);
  });

  it.each([new Error('offline'), new DOMException('timed out', 'TimeoutError')])(
    'reports failed capability probes as unreachable',
    async (error) => {
      const { getVisionAvailability } = await importVision();
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
      await expect(getVisionAvailability()).resolves.toEqual({ available: false, reason: 'unreachable' });
    }
  );

  it.each(['jpeg', 'png', 'webp'] as const)('converts actual %s images to metadata-free JPEG', async (format) => {
    const { sanitizeVisionImage } = await importVision();
    const original = await sharp({ create: { width: 16, height: 8, channels: 3, background: 'red' } })
      .withMetadata({ orientation: 6 })
      .toFormat(format)
      .toBuffer();

    const sanitized = Buffer.from(await sanitizeVisionImage(original.toString('base64')), 'base64');
    const metadata = await sharp(sanitized).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: 8, height: 16 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it('shrinks large photos inside 2400 pixels without enlarging small photos', async () => {
    const { sanitizeVisionImage } = await importVision();
    const photo = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: 'blue' } })
      .png()
      .toBuffer();
    const sanitized = await sanitizeVisionImage(photo.toString('base64'));

    expect(await sharp(Buffer.from(sanitized, 'base64')).metadata()).toMatchObject({ width: 2400, height: 1200 });
  });

  it.each(['', 'invalid!', 'data:image/png;base64,AAAA', 'AAA'])('rejects invalid base64 %j', async (photo) => {
    const { sanitizeVisionImage } = await importVision();
    await expect(sanitizeVisionImage(photo)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects encoded and decoded photos over 10 MiB', async () => {
    const { sanitizeVisionImage } = await importVision();
    await expect(sanitizeVisionImage('A'.repeat(PHOTO_IMPORT_MAX_BASE64_LENGTH + 1))).rejects.toMatchObject({
      statusCode: 413,
    });
    await expect(
      sanitizeVisionImage(Buffer.alloc(PHOTO_IMPORT_MAX_BYTES + 1).toString('base64'))
    ).rejects.toMatchObject({ statusCode: 413 });
  });

  it('rejects corrupt, unsupported and oversized pixel images', async () => {
    const { sanitizeVisionImage } = await importVision();
    const unsupported = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
      .tiff()
      .toBuffer();
    const tooManyPixels = await sharp({ create: { width: 7100, height: 7100, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    for (const photo of [Buffer.from('not an image'), unsupported, tooManyPixels]) {
      await expect(sanitizeVisionImage(photo.toString('base64'))).rejects.toMatchObject({ statusCode: 400 });
    }
  });

  it('rejects multi-frame WebP photos', async () => {
    const { sanitizeVisionImage } = await importVision();
    const photo = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
      raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
    })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();

    expect((await sharp(photo).metadata()).pages).toBe(2);
    await expect(sanitizeVisionImage(photo.toString('base64'))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('normalizes recognized titles and optional visible details', async () => {
    const { parseRecognizedTitles } = await importVision();
    expect(
      parseRecognizedTitles(
        {
          titles: [
            { title: ' Dune ', year: ' 1965 ', contributor: ' Frank Herbert ' },
            { title: 'Unknown', year: '', contributor: ' ' },
            { title: 'Other' },
          ],
        },
        'book'
      )
    ).toEqual({
      titles: [
        { title: 'Dune', year: '1965', contributor: 'Frank Herbert' },
        { title: 'Unknown', year: null, contributor: null },
        { title: 'Other', year: null, contributor: null },
      ],
    });
    expect(parseRecognizedTitles({ titles: [] }, 'book')).toEqual({ titles: [] });
    expect(
      parseRecognizedTitles(
        {
          titles: [{ title: 'x'.repeat(300), year: 'x'.repeat(20), contributor: 'x'.repeat(300) }],
        },
        'book'
      ).titles
    ).toHaveLength(1);
  });

  it.each([
    null,
    [],
    {},
    { titles: 'Dune' },
    { titles: Array.from({ length: 51 }, () => ({ title: 'Dune' })) },
    { titles: [null] },
    { titles: [{}] },
    { titles: [{ title: ' ' }] },
    { titles: [{ title: 1 }] },
    { titles: [{ title: 'x'.repeat(301) }] },
    { titles: [{ title: 'Dune', year: 1965 }] },
    { titles: [{ title: 'Dune', year: 'x'.repeat(21) }] },
    { titles: [{ title: 'Dune', contributor: [] }] },
    { titles: [{ title: 'Dune', contributor: 'x'.repeat(301) }] },
  ])('rejects malformed recognition results %j', async (result) => {
    const { parseRecognizedTitles } = await importVision();
    expect(() => parseRecognizedTitles(result, 'book')).toThrow(expect.objectContaining({ statusCode: 502 }));
  });

  it('sends only sanitized images with configured generation settings and a 180-second timeout', async () => {
    const { recognizePhoto } = await importVision({
      host: 'http://vision.test',
      model: 'vision',
      keep_alive: '5m',
      options: { num_predict: 1000 },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ capabilities: ['vision'] }))
      .mockResolvedValueOnce(Response.json({ response: JSON.stringify({ titles: [{ title: ' Dune ' }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

    await expect(recognizePhoto({ contentType: 'book', imageBase64: await createPhoto() })).resolves.toEqual({
      titles: [{ title: 'Dune', year: null, contributor: null }],
    });
    const [url, request] = fetchMock.mock.calls[1];
    expect(url).toBe('http://vision.test/api/generate');
    const payload = JSON.parse(request.body);
    expect(payload).toMatchObject({
      model: 'vision',
      stream: false,
      keep_alive: '5m',
      options: { temperature: 0, num_predict: 1000 },
    });
    expect(payload.prompt).toContain('One media type only: book');
    expect(payload.prompt).toContain('never infer identifiers');
    expect(payload.format.properties.titles.items.required).toContain('identifier');
    expect(payload.format.properties.titles.maxItems).toBe(50);
    expect(await sharp(Buffer.from(payload.images[0], 'base64')).metadata()).toMatchObject({ format: 'jpeg' });
    expect(timeoutSpy).toHaveBeenCalledWith(180_000);
  });

  it.each([
    [() => Promise.resolve(new Response('failed', { status: 500 })), 502],
    [() => Promise.resolve(new Response('not JSON')), 502],
    [() => Promise.resolve(Response.json({})), 502],
    [() => Promise.resolve(Response.json({ response: 'x'.repeat(100_001) })), 502],
    [() => Promise.resolve(Response.json({ response: 'not JSON' })), 502],
    [() => Promise.reject(new Error('offline')), 502],
    [() => Promise.reject(new DOMException('timed out', 'TimeoutError')), 504],
  ])('maps failed generation to status %s and releases the global slot', async (generate, statusCode) => {
    const { recognizePhoto } = await importVision();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ capabilities: ['vision'] }))
        .mockImplementationOnce(generate)
    );
    const request = { contentType: 'movie' as const, imageBase64: await createPhoto() };

    await expect(recognizePhoto(request)).rejects.toMatchObject({ statusCode });
    await expect(recognizePhoto({ ...request, imageBase64: '' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns 503 without generation when the vision model is unavailable', async () => {
    const { recognizePhoto } = await importVision();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ capabilities: ['completion'] }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(recognizePhoto({ contentType: 'movie', imageBase64: await createPhoto() })).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('allows only one global recognition at a time and releases the slot after success', async () => {
    const { recognizePhoto } = await importVision();
    let finishGeneration: (response: Response) => void = () => {
      throw new Error('Generation has not started');
    };
    let generationStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      generationStarted = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ capabilities: ['vision'] }))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              finishGeneration = resolve;
              generationStarted();
            })
        )
    );
    const request = { contentType: 'movie' as const, imageBase64: await createPhoto() };
    const pending = recognizePhoto(request);
    await started;
    await expect(recognizePhoto(request)).rejects.toMatchObject({ statusCode: 429 });
    finishGeneration(Response.json({ response: '{"titles":[]}' }));
    await expect(pending).resolves.toEqual({ titles: [] });
    await expect(recognizePhoto({ ...request, imageBase64: '' })).rejects.toMatchObject({ statusCode: 400 });
  });
});
