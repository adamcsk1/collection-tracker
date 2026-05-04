import { randomUUID } from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import '../models/express-model';
import { COOKIE_TOKEN } from './cookie/cookie-const';
import { hashText } from './crypto';
import { getDatabase } from './database/database';
import { findAccessTokensByUser } from './database/repositories/user-repository';
import { debugLog, errorLog } from './logger';

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

export const jwtGuard = async (
  request: express.Request,
  response: express.Response,
  next: () => void
): Promise<express.Response | undefined> => {
  await debugLog(`Validating access token (${request.url})`);

  const cookieToken = request.signedCookies[COOKIE_TOKEN];
  const authorizationToken = request.headers['authorization'];
  let token = cookieToken || authorizationToken || '';
  if (token.includes('Bearer ')) token = token.split(' ')[1];

  if (!token) {
    await debugLog('No token found');
    return response.sendStatus(401);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    await errorLog('Access token validation error (JWT secret is not configured)');
    return response.sendStatus(500);
  }

  jwt.verify(token, jwtSecret, async (error: jwt.VerifyErrors | null, data: jwt.JwtPayload | string | undefined) => {
    try {
      if (error) {
        await debugLog(`Access token verification failed (${error.message})`);
        if (error.name === 'TokenExpiredError') {
          return response.sendStatus(401);
        }
        return response.sendStatus(403);
      }

      if (!hasUsername(data)) {
        await debugLog('Access token payload is invalid');
        return response.sendStatus(403);
      }

      const { username } = data;
      const usernameHash = hashText(username);
      const tokenHash = hashText(token);

      const allTokens = new Set(findAccessTokensByUser(getDatabase(), usernameHash).map((t) => t.tokenHash));

      if (!allTokens.has(tokenHash)) {
        await debugLog('Access token not recognized');
        return response.sendStatus(403);
      }

      request.username = username;
      request.usernameHash = usernameHash;

      await debugLog('Access token validated successfully');
      next();
    } catch (error: unknown) {
      if (error instanceof Error) await errorLog(`Access token validation unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
