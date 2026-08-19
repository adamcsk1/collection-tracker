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

export const jwtGuard = async (request: FastifyRequest, response: FastifyReply): Promise<void> => {
  await debugLog(`Validating access token (${getRequestPath(request.url)})`);

  const signedCookieToken = request.cookies[COOKIE_TOKEN];
  const cookieToken = signedCookieToken ? request.unsignCookie(signedCookieToken).value : undefined;
  const authorizationToken = request.headers['authorization'];
  let token = cookieToken || authorizationToken || '';
  if (token.includes('Bearer ')) token = token.split(' ')[1];

  if (!token) {
    await debugLog('No token found');
    response.code(401).send();
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    await errorLog('Access token validation error (JWT secret is not configured)');
    response.code(500).send();
    return;
  }

  try {
    const data = jwt.verify(token, jwtSecret);
    if (!hasUsername(data)) {
      await debugLog('Access token payload is invalid');
      response.code(403).send();
      return;
    }

    const { username } = data;
    const usernameHash = hashText(username);
    const tokenHash = hashText(token);

    if (!hasAccessToken(getDatabase(), usernameHash, tokenHash)) {
      await debugLog('Access token not recognized');
      response.code(403).send();
      return;
    }

    request.username = username;
    request.usernameHash = usernameHash;

    await debugLog('Access token validated successfully');
  } catch (error: unknown) {
    if (error instanceof jwt.JsonWebTokenError) {
      await debugLog(`Access token verification failed (${error.message})`);
      response.code(error.name === 'TokenExpiredError' ? 401 : 403).send();
      return;
    }

    if (error instanceof Error) await errorLog(`Access token validation unknown error (${error.message})`);
    response.code(500).send();
  }
};
