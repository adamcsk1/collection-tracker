import { generateRandomToken, hashText } from './crypto';
import { describe, expect, it } from 'vitest';

describe('crypto', () => {
  it('hashes text with salt', () => {
    process.env.SALT = 'salt';
    const hash = hashText('message', 'salt');
    const hashAgain = hashText('message', 'salt');

    expect(hash).toBe(hashAgain);
    expect(hash).toHaveLength(128);
  });

  it('generates distinct base64url tokens with 256 bits of entropy', () => {
    const firstToken = generateRandomToken();
    const secondToken = generateRandomToken();

    expect(firstToken).toMatch(/^[\w-]{43}$/);
    expect(secondToken).toMatch(/^[\w-]{43}$/);
    expect(secondToken).not.toBe(firstToken);
  });
});
