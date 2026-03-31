import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { generateAccessToken, jwtGuard } from '@server/core/jwt';
import { Store } from '@server/core/store/store';
import { StoreModel } from '@server/core/store/store-model';
import { ExtendedRequestModel } from '@server/models/express-model';
import { AccessTokenModel } from '@shared/models/api-model';
import jwt from 'jsonwebtoken';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@server/core/store/store');
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

  it('jwtGuard rejects when no token provided', async () => {
    const response: any = { sendStatus: vi.fn() };
    const next = vi.fn();

    await jwtGuard({ signedCookies: {}, headers: {}, url: '/x' } as unknown as ExtendedRequestModel, response, next);

    expect(response.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('jwtGuard validates token and sets username', async () => {
    const store: StoreModel = {
      dataFolder: new BehaviorSubject(null),
      users: new BehaviorSubject<any>({
        ['hashed-user']: { accessTokens: [] },
      }),
      parserConfigs: new BehaviorSubject(null),
      tagConfigs: new BehaviorSubject(null),
      userSettings: new BehaviorSubject(null),
      cache: new BehaviorSubject({}),
      fileHashes: new BehaviorSubject({}),
    };
    (Store.getLastValue as Mock).mockImplementation((key: keyof StoreModel) => store[key].value);

    const token = jwt.sign({ username: 'user' }, 'secret');
    store.users.value!['hashed-user'].accessTokens = [{ tokenHash: `hashed-${token}` } as unknown as AccessTokenModel];
    const response: any = { sendStatus: vi.fn() };
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      jwtGuard(
        { signedCookies: { [COOKIE_TOKEN]: token }, headers: {}, url: '/protected' } as unknown as ExtendedRequestModel,
        response,
        () => {
          next();
          resolve();
        },
      );
    });

    expect(response.sendStatus).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('jwtGuard rejects invalid token', async () => {
    const response: any = { sendStatus: vi.fn() };
    const next = vi.fn();

    await jwtGuard(
      {
        signedCookies: {},
        headers: { authorization: 'Bearer invalid' },
        url: '/protected',
      } as unknown as ExtendedRequestModel,
      response,
      next,
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
      } as unknown as ExtendedRequestModel,
      response,
      next,
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
      } as unknown as ExtendedRequestModel,
      response,
      next,
    );

    expect(response.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
