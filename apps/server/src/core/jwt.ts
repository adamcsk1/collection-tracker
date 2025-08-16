import { hashText } from '@server/core/crypto';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import express from 'express';
import jwt from 'jsonwebtoken';

export const generateAccessToken = (username: string, expiresIn: string | null = null): string | null => {
  try {
    let options: any = {};

    if (!!expiresIn) options.expiresIn = expiresIn;

    return jwt.sign({ username }, `${process.env.JWT_SECRET}`, options);
  } catch (error: unknown) {
    if (error instanceof Error) errorLog(`Access token generation unknown error (${error.message})`);
    return null;
  }
};

export const jwtGuard = async (
  request: ExtendedRequestModel,
  response: express.Response,
  next: () => void
): Promise<express.Response> => {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token === null) return response.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET as string, async (err: any, data: any) => {
    try {
      if (err) return response.sendStatus(403);

      const usernameHash = await hashText(`${data.username}${process.env.SALT}`);
      const user = Store.getLastValue('users')[usernameHash];

      if (!user?.accessTokenHashes?.includes(await hashText(`${token}${process.env.SALT}`))) {
        return response.sendStatus(403);
      }

      request.username = data.username;
      request.usernameHash = usernameHash;

      next();
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Access token validation unknown error (${error.message})`);
      return response.sendStatus(500);
    }
  });
};
