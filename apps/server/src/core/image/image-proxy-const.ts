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
