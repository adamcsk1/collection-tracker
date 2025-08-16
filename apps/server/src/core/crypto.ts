import { randomUUID } from 'crypto';
import { generate } from 'random-words';

export const hashText = async (message: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

export const generateRandomToken = (length: number = 128): string =>
  `${(generate(length) as Array<string>).join(' ')} ${randomUUID().replace(/-/g, '')}`;
