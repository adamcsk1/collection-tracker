import { COOKIE_TOKEN } from './cookie/cookie-const';
import { getDatabase } from './database/database';
import { generateAccessToken, generateRefreshToken, jwtGuard } from './jwt';
import type { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));

describe('jwt utilities', () => {
  const mockResponse = () => {
    const response: any = {};
    response.send = vi.fn().mockReturnValue(response);
    response.code = vi.fn().mockReturnValue(response);
    return response;
  };

  const mockRequest = (request: Partial<FastifyRequest> & { cookies?: Record<string, string> }) =>
    ({
      cookies: {},
      headers: {},
      url: '/protected',
      unsignCookie: (value: string) => ({ valid: true, value }),
      ...request,
    }) as unknown as FastifyRequest;

  beforeEach(() => {
    process.env.JWT_SECRET = 'secret';
    vi.restoreAllMocks();
  });

  it('generates an access token and returns empty string on errors', async () => {
    const token = await generateAccessToken('neo', '1h');
    expect(token).toBeTruthy();

    const signSpy = vi.spyOn(jwt, 'sign').mockImplementation(() => {
      throw new Error('fail');
    });
    expect(await generateAccessToken('neo')).toBe('');
    signSpy.mockRestore();
  });

  it('generates a refresh token and returns empty string on errors', async () => {
    const token = await generateRefreshToken('neo', '1h');
    expect(token).toBeTruthy();

    const signSpy = vi.spyOn(jwt, 'sign').mockImplementation(() => {
      throw new Error('fail');
    });
    expect(await generateRefreshToken('neo')).toBe('');
    signSpy.mockRestore();
  });

  it('jwtGuard rejects when no token provided', async () => {
    const response = mockResponse();

    await jwtGuard(mockRequest({ url: '/x' }), response);

    expect(response.code).toHaveBeenCalledWith(401);
  });

  it('jwtGuard validates token and sets username', async () => {
    const token = jwt.sign({ username: 'user' }, 'secret');
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('hashed-user', 'token');
    db.prepare(
      'INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('hashed-user', `hashed-${token}`, 'now', 'agent', null);
    const response = mockResponse();
    const request = mockRequest({ cookies: { [COOKIE_TOKEN]: token } });

    await jwtGuard(request, response);

    expect(response.code).not.toHaveBeenCalled();
    expect(request.username).toBe('user');
    expect(request.usernameHash).toBe('hashed-user');
  });

  it('jwtGuard rejects expired token with 401', async () => {
    const token = jwt.sign({ username: 'user' }, 'secret', { expiresIn: '-1s' });
    const response = mockResponse();

    await jwtGuard(mockRequest({ cookies: { [COOKIE_TOKEN]: token } }), response);

    expect(response.code).toHaveBeenCalledWith(401);
  });

  it('jwtGuard rejects invalid token with 403', async () => {
    const response = mockResponse();

    await jwtGuard(
      mockRequest({
        headers: { authorization: 'Bearer invalid' },
      }),
      response
    );

    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('jwtGuard returns 500 when JWT secret is missing', async () => {
    delete process.env.JWT_SECRET;
    const response = mockResponse();

    await jwtGuard(
      mockRequest({
        headers: { authorization: 'Bearer any-token' },
      }),
      response
    );

    expect(response.code).toHaveBeenCalledWith(500);
  });

  it('jwtGuard rejects token payloads without username', async () => {
    const token = jwt.sign({ id: 'missing-username' }, 'secret');
    const response = mockResponse();

    await jwtGuard(mockRequest({ cookies: { [COOKIE_TOKEN]: token } }), response);

    expect(response.code).toHaveBeenCalledWith(403);
  });
});
