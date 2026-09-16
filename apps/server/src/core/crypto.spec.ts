import { generateRandomToken, hashText } from './crypto';
import { describe, expect, it } from 'vitest';

describe('crypto', () => {
  it('hashes text with salt', () => {
    const hash = hashText('message', 'salt');

    expect(hash).toBe(
      'a8255e3e70273fe9c3c123a43bd4ddb0aac0145c6fc077a12d6d879eb9843df6894f0ba3ef357db311651591ec8819221ae59ffac9c98f2cd05c42024c09321b'
    );
    expect(hashText('different message', 'salt')).not.toBe(hash);
    expect(hashText('message', 'different salt')).not.toBe(hash);
  });

  it('generates distinct base64url tokens with 256 bits of entropy', () => {
    const firstToken = generateRandomToken();
    const secondToken = generateRandomToken();

    expect(firstToken).toMatch(/^[\w-]{43}$/);
    expect(secondToken).toMatch(/^[\w-]{43}$/);
    expect(secondToken).not.toBe(firstToken);
  });
});
