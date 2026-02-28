import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { hashText } from '@server/core/crypto';
import { debugLog, errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { randomUUID } from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

const hasUsername = (data: jwt.JwtPayload | string | undefined): data is { username: string } =>
  typeof data === 'object' && data !== null && 'username' in data && typeof data.username === 'string';

export const generateAccessToken = (
  username: string,
  expiresIn: jwt.SignOptions['expiresIn'] | null = null
): string | null => {
  try {
    void debugLog('Generating access token');
    const options: jwt.SignOptions = {};

    if (expiresIn) options.expiresIn = expiresIn;

    return jwt.sign({ username, id: randomUUID() }, `${process.env.JWT_SECRET}`, options);
  } catch (error: unknown) {
    if (error instanceof Error) void errorLog(`Access token generation unknown error (${error.message})`);
    return null;
  }
};

export const jwtGuard = async (
  request: ExtendedRequestModel,
  response: express.Response,
  next: () => void
): Promise<express.Response | undefined> => {
  void debugLog(`Validating access token (${request.url})`);

  const cookieToken = request.signedCookies[COOKIE_TOKEN];
  const authorizationToken = request.headers['authorization'];
  let token = cookieToken || authorizationToken || '';
  if (token.includes('Bearer ')) token = token.split(' ')[1];

  if (!token) {
    void debugLog('No token found');
    return response.sendStatus(401);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    void errorLog('Access token validation error (JWT secret is not configured)');
    return response.sendStatus(500);
  }

  jwt.verify(token, jwtSecret, (error: jwt.VerifyErrors | null, data: jwt.JwtPayload | string | undefined) => {
    try {
      if (error) {
        void debugLog(`Access token verification failed (${error.message})`);
        return response.sendStatus(403);
      }

      if (!hasUsername(data)) {
        void debugLog('Access token payload is invalid');
        return response.sendStatus(403);
      }

      const { username } = data;
      const usernameHash = hashText(username);
      const users = Store.getLastValue('users');
      const tokenHash = hashText(token);

      if (!users[usernameHash]?.accessTokens?.map((token) => token.tokenHash)?.includes(tokenHash)) {
        void debugLog('Access token not recognized');
        return response.sendStatus(403);
      }

      request.username = username;
      request.usernameHash = usernameHash;

      void debugLog('Access token validated successfully');
      next();
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Access token validation unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
