import type { FastifyRequest } from 'fastify';
import { isIP } from 'net';
import { errorLog } from '../logger';

export const getRateLimitKey = (request: FastifyRequest): string => {
  const forwardedForHeader = request.headers['x-forwarded-for'];
  const forwardedFor = Array.isArray(forwardedForHeader) ? forwardedForHeader[0] : forwardedForHeader;
  const realIpHeader = request.headers['x-real-ip'];
  const realIp = Array.isArray(realIpHeader) ? realIpHeader[0] : realIpHeader;
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp?.trim() || request.socket.remoteAddress;

  if (!ipAddress) {
    errorLog('Unable to determine request IP for rate limiting.');
    return 'unknown-client';
  }

  const normalizedIpAddress = ipAddress.trim().replace(/^\[([\da-f:.]+)](?::\d+)?$/i, '$1');
  const withoutIpv4Port = normalizedIpAddress.replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1');

  if (!isIP(withoutIpv4Port)) {
    errorLog(`Invalid request IP for rate limiting (${ipAddress}).`);
    return 'unknown-client';
  }

  return withoutIpv4Port;
};
