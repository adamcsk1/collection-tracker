import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { generateAccessToken, jwtGuard } from '@server/core/jwt';
import { Store } from '@server/core/store/store';
import { StoreModel } from '@server/core/store/store-model';
import { ExtendedRequestModel } from '@server/models/express-model';
import { AccessTokenModel } from '@shared/models/api-model';
import jwt from 'jsonwebtoken';
import { BehaviorSubject } from 'rxjs';

jest.mock('@server/core/store/store');
jest.mock('@server/core/crypto', () => ({
  hashText: jest.fn(async (text: string) => `hashed-${text}`),
}));

describe('jwt utilities', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'secret';
    jest.clearAllMocks();
  });

  it('generates an access token and returns null on errors', () => {
    const token = generateAccessToken('neo', '1h');
    expect(token).toBeTruthy();

    const signSpy = jest.spyOn(jwt, 'sign').mockImplementation(() => {
      throw new Error('fail');
    });
    expect(generateAccessToken('neo')).toBeNull();
    signSpy.mockRestore();
  });

  it('jwtGuard rejects when no token provided', async () => {
    const response: any = { sendStatus: jest.fn() };
    const next = jest.fn();

    await jwtGuard({ signedCookies: {}, headers: {}, url: '/x' } as unknown as ExtendedRequestModel, response, next);

    expect(response.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('jwtGuard validates token and sets username', async () => {
    const store: StoreModel = {
      app: new BehaviorSubject(null),
      dataFolder: new BehaviorSubject(null),
      users: new BehaviorSubject<any>({
        ['hashed-user']: { accessTokens: [] },
      }),
      cache: new BehaviorSubject({}),
    };
    (Store.getLastValue as jest.Mock).mockImplementation((key: keyof StoreModel) => store[key].value);

    const token = jwt.sign({ username: 'user' }, 'secret');
    store.users.value!['hashed-user'].accessTokens = [{ tokenHash: `hashed-${token}` } as unknown as AccessTokenModel];
    const response: any = { sendStatus: jest.fn() };
    const next = jest.fn();

    await new Promise<void>((resolve) => {
      jwtGuard(
        { signedCookies: { [COOKIE_TOKEN]: token }, headers: {}, url: '/protected' } as unknown as ExtendedRequestModel,
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

  it('jwtGuard rejects invalid token', async () => {
    const response: any = { sendStatus: jest.fn() };
    const next = jest.fn();

    await jwtGuard(
      {
        signedCookies: {},
        headers: { authorization: 'Bearer invalid' },
        url: '/protected',
      } as unknown as ExtendedRequestModel,
      response,
      next
    );

    expect(response.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
