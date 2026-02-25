import { createHash, randomUUID } from 'crypto';
import { generate } from 'random-words';

export const hashText = (message: string, salt = process.env.SALT): string =>
  createHash('sha512')
    .update(message + (salt ?? ''))
    .digest('hex');

export const generateRandomToken = (seed: string = randomUUID(), length: number = 128): string =>
  `${generate({ exactly: length, join: ' ' })} ${generate({ exactly: 5, join: ' ', seed })}`;
