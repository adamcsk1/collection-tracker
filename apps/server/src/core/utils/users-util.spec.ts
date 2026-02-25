import { getUserAccessToken } from '@server/core/utils/users-util';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));

describe('users-util', () => {
  it('builds access token model with hashed token and timestamps', () => {
    const expires = new Date('2024-01-02T03:04:05.000Z');

    const token = getUserAccessToken('plain', 'agent', expires);

    expect(token.tokenHash).toBe('hashed-plain');
    expect(token.userAgent).toBe('agent');
    expect(token.expiresAt).toBe(expires.toISOString());
    expect(typeof token.createdAt).toBe('string');
  });

  it('sets expiresAt null when expires is not provided', () => {
    const token = getUserAccessToken('plain', 'agent', null);

    expect(token.expiresAt).toBeNull();
  });
});
