import { generateRandomToken, hashText } from '@server/core/crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('random-words', () => ({
  __esModule: true,
  generate: vi.fn(({ exactly, seed }: { exactly: number; seed?: string }) =>
    Array(exactly)
      .fill(seed ? `seed-${seed}` : 'word')
      .join(' ')
  ),
}));

describe('crypto', () => {
  it('hashes text with salt', async () => {
    process.env.SALT = 'salt';
    const hash = await hashText('message', 'salt');
    const hashAgain = await hashText('message', 'salt');

    expect(hash).toBe(hashAgain);
    expect(hash).toHaveLength(128);
  });

  it('generates random token with expected length', () => {
    const token = generateRandomToken('seed', 5);
    const words = token.split(' ');
    expect(words.length).toBe(10);
  });
});
