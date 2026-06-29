import { createHash } from 'crypto';
import { lookup } from 'dns/promises';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { isIP } from 'net';
import { extname, join } from 'path';
import { getArgv } from '../argv/argv';
import { FOLDERS } from '../main-const';
import { CONTENT_TYPE_EXTENSIONS, FETCH_TIMEOUT_MS, MAX_IMAGE_BYTES } from './image-proxy-const';
import { ImageCacheMetadata, ImageProxyResult, ProxiedImageResponse, PublicTarget } from './image-proxy-model';

const getImageCacheFolder = (): string => {
  const folder = join(getArgv().dataFolder, FOLDERS.cache);
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
  return folder;
};

const getCacheKey = (url: string): string => createHash('sha256').update(url).digest('hex');

const isBlockedHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return normalized === 'localhost' || normalized.endsWith('.localhost');
};

const isBlockedIp = (address: string): boolean => {
  if (isIP(address) === 4) {
    const [first = 0, second = 0] = address.split('.').map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first >= 224
    );
  }

  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith('::ffff:')) return isBlockedIp(normalized.slice(7));

    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('ff')
    );
  }

  return true;
};

const getPublicTarget = async (url: URL): Promise<PublicTarget | null> => {
  if (isBlockedHostname(url.hostname)) return null;

  const directIp = isIP(url.hostname);
  if (directIp === 4 || directIp === 6) {
    return isBlockedIp(url.hostname) ? null : { address: url.hostname, family: directIp };
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: false });
  const publicAddresses = addresses.filter(({ address }) => !isBlockedIp(address));
  if (!publicAddresses.length || publicAddresses.length !== addresses.length) return null;

  return publicAddresses[0] as PublicTarget;
};

const readImageBytes = async (stream: NodeJS.ReadableStream, contentLength: number): Promise<Buffer | null> => {
  if (contentLength > MAX_IMAGE_BYTES) return null;

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_IMAGE_BYTES) {
      return null;
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
};

const fetchImage = (url: URL, target: PublicTarget): Promise<ProxiedImageResponse> => {
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const clientRequest = request(
      {
        protocol: url.protocol,
        hostname: target.address,
        family: target.family,
        servername: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { Host: url.host, 'User-Agent': 'CollectionTracker/1.0' },
        timeout: FETCH_TIMEOUT_MS,
      },
      async (proxiedResponse) => {
        try {
          const statusCode = proxiedResponse.statusCode ?? 502;
          const contentType = String(proxiedResponse.headers['content-type'] ?? 'application/octet-stream');
          const contentLength = Number(proxiedResponse.headers['content-length'] ?? 0);

          resolve({ statusCode, contentType, image: await readImageBytes(proxiedResponse, contentLength) });
        } catch (error) {
          reject(error);
        }
      }
    );

    clientRequest.on('error', reject);
    clientRequest.on('timeout', () => clientRequest.destroy(new Error('Image proxy request timed out')));
    clientRequest.end();
  });
};

const getExtension = (url: URL, contentType: string): string => {
  const contentTypeExtension = CONTENT_TYPE_EXTENSIONS[contentType.split(';')[0].toLowerCase()];
  if (contentTypeExtension) return contentTypeExtension;

  const urlExtension = extname(url.pathname).toLowerCase();
  return urlExtension && urlExtension.length <= 6 ? urlExtension : '.img';
};

const readMetadata = (path: string): ImageCacheMetadata | null => {
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as ImageCacheMetadata;
  } catch {
    return null;
  }
};

export const fetchAndCacheImageWithDetails = async (sourceUrl: string): Promise<ImageProxyResult> => {
  let url: URL;

  try {
    url = new URL(sourceUrl);
  } catch {
    return { kind: 'invalid-url' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { kind: 'invalid-url' };
  }

  const target = await getPublicTarget(url);
  if (!target) {
    return { kind: 'blocked' };
  }

  const cacheFolder = getImageCacheFolder();
  const cacheKey = getCacheKey(url.href);
  const metadataPath = join(cacheFolder, `${cacheKey}.json`);
  const metadata = readMetadata(metadataPath);

  if (metadata) {
    const imagePath = join(cacheFolder, metadata.fileName);
    if (existsSync(imagePath)) {
      return { kind: 'cached' };
    }
  }

  const proxiedResponse = await fetchImage(url, target);
  if (proxiedResponse.statusCode >= 300 && proxiedResponse.statusCode < 400) {
    return { kind: 'redirect' };
  }

  if (proxiedResponse.statusCode < 200 || proxiedResponse.statusCode >= 300) {
    return { kind: 'upstream-error', statusCode: proxiedResponse.statusCode };
  }

  const contentType = proxiedResponse.contentType;
  const normalizedContentType = contentType.split(';')[0].toLowerCase();
  if (!CONTENT_TYPE_EXTENSIONS[normalizedContentType]) {
    return { kind: 'not-image' };
  }

  const image = proxiedResponse.image;
  if (!image) {
    return { kind: 'too-large' };
  }

  const fileName = `${cacheKey}${getExtension(url, contentType)}`;
  writeFileSync(join(cacheFolder, fileName), image);
  writeFileSync(
    metadataPath,
    JSON.stringify({ contentType, fileName, sourceUrl: url.href } satisfies ImageCacheMetadata)
  );

  return { kind: 'fetched' };
};

export const fetchAndCacheImage = async (sourceUrl: string): Promise<boolean> => {
  const result = await fetchAndCacheImageWithDetails(sourceUrl);
  return result.kind === 'cached' || result.kind === 'fetched';
};

export const getCachedImage = (sourceUrl: string): { contentType: string; buffer: Buffer } | null => {
  let url: URL;

  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return null;
  }

  const cacheFolder = getImageCacheFolder();
  const cacheKey = getCacheKey(url.href);
  const metadataPath = join(cacheFolder, `${cacheKey}.json`);
  const metadata = readMetadata(metadataPath);

  if (metadata) {
    const imagePath = join(cacheFolder, metadata.fileName);
    if (existsSync(imagePath)) {
      return { contentType: metadata.contentType, buffer: readFileSync(imagePath) };
    }
  }

  return null;
};
