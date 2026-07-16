import { createHash, randomBytes } from 'crypto';

export const hashText = (message: string, salt = process.env.SALT): string =>
  createHash('sha512')
    .update(message + (salt ?? ''))
    .digest('hex');

export const generateRandomToken = (): string => randomBytes(32).toString('base64url');
