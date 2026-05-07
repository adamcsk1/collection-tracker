import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { getRateLimitKey } from './rate-limit-util';

const buildRequest = (headers: FastifyRequest['headers'] = {}, remoteAddress?: string): FastifyRequest =>
  ({ headers, socket: { remoteAddress } }) as unknown as FastifyRequest;

describe('rate-limit-util', () => {
  describe('getRateLimitKey', () => {
    it('falls back safely when the request IP is unavailable', () => {
      expect(getRateLimitKey(buildRequest())).toBe('unknown-client');
    });

    it('uses the socket remote address when Fastify does not provide a forwarded header', () => {
      expect(getRateLimitKey(buildRequest({}, '203.0.113.10'))).toBe('203.0.113.10');
    });

    it('uses forwarded IP headers without reading request.ip', () => {
      const request = buildRequest({ 'x-forwarded-for': '203.0.113.11, 10.0.0.1' }, '10.0.0.2');
      Object.defineProperty(request, 'ip', {
        get: () => {
          throw new Error('request.ip should not be read');
        },
      });

      expect(getRateLimitKey(request)).toBe('203.0.113.11');
    });

    it('normalizes IP addresses that include a port', () => {
      expect(getRateLimitKey(buildRequest({ 'x-forwarded-for': '203.0.113.10:443' }))).toBe('203.0.113.10');
      expect(getRateLimitKey(buildRequest({ 'x-forwarded-for': '[2001:db8::1]:443' }))).toBe('2001:db8::1');
    });
  });
});
