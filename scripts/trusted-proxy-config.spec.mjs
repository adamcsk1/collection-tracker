import { describe, expect, it } from 'vitest';
import { renderTrustedProxyConfig } from '../docker/trusted-proxy-config.mjs';

describe('trusted proxy config', () => {
  it('renders no trust configuration by default', () => {
    expect(renderTrustedProxyConfig()).toBe('');
  });

  it('renders validated IPv4 and IPv6 proxy ranges', () => {
    expect(renderTrustedProxyConfig('127.0.0.1, 172.18.0.0/16, 2001:db8::/32')).toBe(
      [
        'real_ip_header X-Forwarded-For;',
        'real_ip_recursive on;',
        'set_real_ip_from 127.0.0.1;',
        'set_real_ip_from 172.18.0.0/16;',
        'set_real_ip_from 2001:db8::/32;',
      ].join('\n')
    );
  });

  it.each([
    'example.com',
    '10.0.0.0/33',
    '2001:db8::/129',
    '10.0.0.1/24/1',
    '10.0.0.1/',
    '10.0.0.1/1e1',
    '10.0.0.1/+1',
    '10.0.0.1; deny all',
  ])('rejects invalid or injectable value %s', (value) => {
    expect(() => renderTrustedProxyConfig(value)).toThrow(`Invalid trusted proxy IP or CIDR: ${value}`);
  });
});
