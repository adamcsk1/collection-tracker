import { describe, expect, it } from 'vitest';
import { fetchAndCacheImage, fetchAndCacheImageWithDetails, getCachedImage } from './image-proxy';

describe('image-proxy', () => {
  it.each(['not a url', 'file:///tmp/image.jpg', 'ftp://images.example/image.jpg'])(
    'rejects invalid source URL %s',
    async (sourceUrl) => {
      expect(await fetchAndCacheImageWithDetails(sourceUrl)).toEqual({ kind: 'invalid-url' });
      expect(getCachedImage(sourceUrl)).toBeNull();
    }
  );

  it.each([
    'http://localhost/image.jpg',
    'http://assets.localhost/image.jpg',
    'http://0.0.0.0/image.jpg',
    'http://10.0.0.1/image.jpg',
    'http://100.64.0.1/image.jpg',
    'http://127.0.0.1/image.jpg',
    'http://169.254.1.1/image.jpg',
    'http://172.16.0.1/image.jpg',
    'http://192.168.0.1/image.jpg',
    'http://224.0.0.1/image.jpg',
    'http://[::]/image.jpg',
    'http://[::1]/image.jpg',
    'http://[fc00::1]/image.jpg',
    'http://[fe80::1]/image.jpg',
    'http://[ff00::1]/image.jpg',
    'http://[::ffff:127.0.0.1]/image.jpg',
  ])('blocks private image target %s', async (sourceUrl) => {
    expect(await fetchAndCacheImageWithDetails(sourceUrl)).toEqual({ kind: 'blocked' });
    expect(await fetchAndCacheImage(sourceUrl)).toBe(false);
  });
});
