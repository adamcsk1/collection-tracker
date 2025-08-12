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

export const verifyAccessToken = async (username: string, accessToken: string): Promise<void> =>
  new Promise<void>((resolve, reject) =>
    jwt.verify(accessToken, process.env.JWT_SECRET as string, async (err: any, data: any) => {
      try {
        const usernameHash = await hashText(`${data.username}${process.env.SALT}`);
        const user = Store.getLastValue('users')[usernameHash];

        if (
          err ||
          data.username !== username ||
          user?.accessTokenHash !== (await hashText(`${accessToken}${process.env.SALT}`))
        ) {
          reject();
        } else resolve();
      } catch (error: unknown) {
        if (error instanceof Error) errorLog(`Access token verify unknown error (${error.message})`);
        return reject();
      }
    })
  );

export const jwtGuard = async (
  req: ExtendedRequestModel,
  res: express.Response,
  next: () => void
): Promise<express.Response> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token === null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET as string, async (err: any, data: any) => {
    try {
      if (err) return res.sendStatus(403);

      const usernameHash = await hashText(`${data.username}${process.env.SALT}`);
      const user = Store.getLastValue('users')[usernameHash];

      if (user?.accessTokenHash !== (await hashText(`${token}${process.env.SALT}`))) {
        return res.sendStatus(403);
      }

      req.username = data.username;
      req.usernameHash = usernameHash;

      next();
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Access token validation unknown error (${error.message})`);
      return res.sendStatus(500);
    }
  });
};
