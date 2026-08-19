export const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 30_000;
export const MAX_REDIRECT_HOPS = 5;
export const IMAGE_CACHE_MAX_BYTES = 512 * 1024 * 1024;
// 10,000 entries bounds inode use and quota-scan work; 8 KiB estimates two directory entries, metadata, and blocks.
export const IMAGE_CACHE_MAX_ENTRIES = 10_000;
export const IMAGE_CACHE_ENTRY_OVERHEAD_BYTES = 8 * 1024;
export const IMAGE_PROXY_CONCURRENCY = 4;
export const IMAGE_PROXY_QUEUE_MAX = 32;
export const IMAGE_PROXY_QUEUE_TIMEOUT_MS = 10_000;
