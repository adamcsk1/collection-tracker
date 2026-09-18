import { describe, expect, it } from 'vitest';
import { getProxyImageUrl } from './proxy-image-url-util';

describe('getProxyImageUrl', () => {
  it('proxies external http image URLs', () => {
    expect(getProxyImageUrl('https://api.test/api/v1', 'https://images.example/poster.jpg?size=large')).toBe(
      'https://api.test/api/v1/images/proxy?url=https%3A%2F%2Fimages.example%2Fposter.jpg%3Fsize%3Dlarge'
    );
  });

  it('appends a variant query for cards and backgrounds', () => {
    expect(getProxyImageUrl('https://api.test/api/v1', 'https://images.example/poster.jpg', 'card')).toBe(
      'https://api.test/api/v1/images/proxy?url=https%3A%2F%2Fimages.example%2Fposter.jpg&variant=card'
    );
  });

  it('replaces an existing variant on an already proxied URL', () => {
    const proxied = 'https://api.test/api/v1/images/proxy?url=https%3A%2F%2Fimages.example%2Fposter.jpg&variant=card';

    expect(getProxyImageUrl('https://api.test/api/v1', proxied, 'background')).toBe(
      'https://api.test/api/v1/images/proxy?url=https%3A%2F%2Fimages.example%2Fposter.jpg&variant=background'
    );
  });

  it('keeps empty, relative, and already proxied URLs unchanged', () => {
    const proxied = 'https://api.test/api/v1/images/proxy?url=https%3A%2F%2Fimages.example%2Fposter.jpg';

    expect(getProxyImageUrl('https://api.test/api/v1', '')).toBe('');
    expect(getProxyImageUrl('https://api.test/api/v1', '/client/images/icon.png')).toBe('/client/images/icon.png');
    expect(getProxyImageUrl('https://api.test/api/v1', proxied)).toBe(proxied);
  });
});
