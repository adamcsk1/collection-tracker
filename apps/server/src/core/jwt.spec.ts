import { COOKIE_TOKEN } from './cookie/cookie-const';
import { getDatabase } from './database/database';
import { generateAccessToken, generateRefreshToken, jwtGuard } from './jwt';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));

describe('jwt utilities', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'secret';
    vi.clearAllMocks();
  });

  it('generates an access token and returns null on errors', () => {
    const token = generateAccessToken('neo', '1h');
    expect(token).toBeTruthy();

    const signSpy = vi.spyOn(jwt, 'sign').mockImplementation(() => {
      throw new Error('fail');
    });
    expect(generateAccessToken('neo')).toBeNull();
    signSpy.mockRestore();
  });

  it('generates a refresh token and returns null on errors', () => {
    const token = generateRefreshToken('neo', '1h');
    expect(token).toBeTruthy();

    const signSpy = vi.spyOn(jwt, 'sign').mockImplementation(() => {
      throw new Error('fail');
    });
    expect(generateRefreshToken('neo')).toBeNull();
    signSpy.mockRestore();
  });

  it('jwtGuard rejects when no token provided', async () => {
    const response: any = { sendStatus: vi.fn() };
    const next = vi.fn();

    await jwtGuard({ signedCookies: {}, headers: {}, url: '/x' } as unknown as Request, response, next);

    expect(response.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('jwtGuard validates token and sets username', async () => {
    const token = jwt.sign({ username: 'user' }, 'secret');
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('hashed-user', 'token');
    db.prepare(
      'INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('hashed-user', `hashed-${token}`, 'now', 'agent', null);
    const response: any = { sendStatus: vi.fn() };
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      jwtGuard(
        { signedCookies: { [COOKIE_TOKEN]: token }, headers: {}, url: '/protected' } as unknown as Request,
        response,
        () => {
          next();
          resolve();
        }
      );
    });

    expect(response.sendStatus).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('jwtGuard rejects expired token with 401', async () => {
    const token = jwt.sign({ username: 'user' }, 'secret', { expiresIn: '-1s' });
    const response: any = { sendStatus: vi.fn() };
    const next = vi.fn();

    await jwtGuard(
      {
        signedCookies: { [COOKIE_TOKEN]: token },
        headers: {},
        url: '/protected',
      } as unknown as Request,
      response,
      next
    );

    expect(response.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('jwtGuard rejects invalid token with 403', async () => {
    const response: any = { sendStatus: vi.fn() };
    const next = vi.fn();

    await jwtGuard(
      {
        signedCookies: {},
        headers: { authorization: 'Bearer invalid' },
        url: '/protected',
      } as unknown as Request,
      response,
      next
    );

    expect(response.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('jwtGuard returns 500 when JWT secret is missing', async () => {
    delete process.env.JWT_SECRET;
    const response: any = { sendStatus: vi.fn() };
    const next = vi.fn();

    await jwtGuard(
      {
        signedCookies: {},
        headers: { authorization: 'Bearer any-token' },
        url: '/protected',
      } as unknown as Request,
      response,
      next
    );

    expect(response.sendStatus).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('jwtGuard rejects token payloads without username', async () => {
    const token = jwt.sign({ id: 'missing-username' }, 'secret');
    const response: any = { sendStatus: vi.fn() };
    const next = vi.fn();

    await jwtGuard(
      {
        signedCookies: { [COOKIE_TOKEN]: token },
        headers: {},
        url: '/protected',
      } as unknown as Request,
      response,
      next
    );

    expect(response.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
