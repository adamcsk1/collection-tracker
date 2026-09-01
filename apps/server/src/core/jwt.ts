import { randomUUID } from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import '../models/fastify-model';
import { COOKIE_TOKEN } from './cookie/cookie-const';
import { hashText } from './crypto';
import { getDatabase } from './database/database';
import { hasAccessToken } from './database/repositories/user-repository';
import { debugLog, errorLog } from './logger';
import { getRequestPath } from './utils/request-url-util';

const hasUsername = (data: jwt.JwtPayload | string | undefined): data is { username: string } =>
  typeof data === 'object' && data !== null && 'username' in data && typeof data.username === 'string';

export const generateAccessToken = async (
  username: string,
  expiresIn: jwt.SignOptions['expiresIn'] | null = null
): Promise<string> => {
  try {
    await debugLog('Generating access token');
    const options: jwt.SignOptions = {};

    if (expiresIn) options.expiresIn = expiresIn;

    return jwt.sign({ username, id: randomUUID() }, `${process.env.JWT_SECRET}`, options);
  } catch (error: unknown) {
    if (error instanceof Error) await errorLog(`Access token generation unknown error (${error.message})`);
    return '';
  }
};

export const generateRefreshToken = async (
  username: string,
  expiresIn: jwt.SignOptions['expiresIn'] | null = null
): Promise<string> => {
  try {
    await debugLog('Generating refresh token');
    const options: jwt.SignOptions = {};

    if (expiresIn) options.expiresIn = expiresIn;

    return jwt.sign({ username, id: randomUUID(), type: 'refresh' }, `${process.env.JWT_SECRET}`, options);
  } catch (error: unknown) {
    if (error instanceof Error) await errorLog(`Refresh token generation unknown error (${error.message})`);
    return '';
  }
};

const getRequestAccessToken = (request: FastifyRequest): string => {
  const signedCookieToken = request.cookies[COOKIE_TOKEN];
  const cookieToken = signedCookieToken ? request.unsignCookie(signedCookieToken).value : undefined;
  const authorizationToken = request.headers['authorization'];
  let token = cookieToken || authorizationToken || '';
  if (token.includes('Bearer ')) token = token.split(' ')[1];
  return token;
};

type AccessTokenResult = 'ok' | 'missing-secret' | 'expired' | 'invalid' | 'error';

const applyAccessToken = async (request: FastifyRequest, token: string): Promise<AccessTokenResult> => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    await errorLog('Access token validation error (JWT secret is not configured)');
    return 'missing-secret';
  }

  try {
    const data = jwt.verify(token, jwtSecret);
    if (!hasUsername(data)) {
      await debugLog('Access token payload is invalid');
      return 'invalid';
    }

    const { username } = data;
    const usernameHash = hashText(username);
    const tokenHash = hashText(token);

    if (!hasAccessToken(getDatabase(), usernameHash, tokenHash)) {
      await debugLog('Access token not recognized');
      return 'invalid';
    }

    request.username = username;
    request.usernameHash = usernameHash;

    await debugLog('Access token validated successfully');
    return 'ok';
  } catch (error: unknown) {
    if (error instanceof jwt.JsonWebTokenError) {
      await debugLog(`Access token verification failed (${error.message})`);
      return error.name === 'TokenExpiredError' ? 'expired' : 'invalid';
    }

    if (error instanceof Error) await errorLog(`Access token validation unknown error (${error.message})`);
    return 'error';
  }
};

const sendAccessTokenFailure = (response: FastifyReply, result: Exclude<AccessTokenResult, 'ok'>): void => {
  if (result === 'expired') response.code(401).send();
  else if (result === 'missing-secret' || result === 'error') response.code(500).send();
  else response.code(403).send();
};

export const jwtGuard = async (request: FastifyRequest, response: FastifyReply): Promise<void> => {
  await debugLog(`Validating access token (${getRequestPath(request.url)})`);

  const token = getRequestAccessToken(request);
  if (!token) {
    await debugLog('No token found');
    response.code(401).send();
    return;
  }

  const result = await applyAccessToken(request, token);
  if (result !== 'ok') sendAccessTokenFailure(response, result);
};

export const optionalJwtGuard = async (request: FastifyRequest, response: FastifyReply): Promise<void> => {
  const token = getRequestAccessToken(request);
  if (!token) return;

  await debugLog(`Validating access token (${getRequestPath(request.url)})`);
  const result = await applyAccessToken(request, token);
  if (result === 'ok') return;
  if (result === 'missing-secret' || result === 'error') {
    sendAccessTokenFailure(response, result);
  }
};
