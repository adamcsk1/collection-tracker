import { hashText } from '../crypto';
import { AccessTokenModel } from '@shared/models/api-model';
import dayjs from 'dayjs';

export const getUserAccessToken = (accessToken: string, userAgent: string, expires: Date | null): AccessTokenModel => ({
  tokenHash: hashText(accessToken),
  createdAt: dayjs().toISOString(),
  userAgent: userAgent,
  expiresAt: expires?.toISOString() || null,
});
