import { randomUUID } from 'crypto';
import { generate } from 'random-words';

export const hashText = async (message: string, salt = process.env.SALT): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

export const generateRandomToken = (seed: string = randomUUID(), length: number = 128): string =>
  `${generate({ exactly: length, join: ' ' })} ${generate({ exactly: 5, join: ' ', seed })}`;
