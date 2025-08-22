import { hashText } from '@server/core/crypto';
import { AccessTokenModel } from '@shared/models/api-model';
import dayjs from 'dayjs';

export const getUserAccessToken = async (
  accessToken: string,
  userAgent: string,
  expires: Date | null
): Promise<AccessTokenModel> => ({
  tokenHash: await hashText(`${accessToken}${process.env.SALT}`),
  createdAt: dayjs().toISOString(),
  userAgent: userAgent,
  expiredAt: expires?.toISOString() || null,
});
