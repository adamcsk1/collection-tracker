import { hashText } from '../crypto';
import { AccessTokenModel, RefreshTokenModel } from '@shared/models/api-model';
import dayjs from 'dayjs';

export const getUserAccessToken = (accessToken: string, userAgent: string, expires: Date | null): AccessTokenModel => ({
  tokenHash: hashText(accessToken),
  createdAt: dayjs().toISOString(),
  userAgent: userAgent,
  expiresAt: expires?.toISOString() || null,
});

export const getUserRefreshToken = (
  refreshToken: string,
  userAgent: string,
  expires: Date | null
): RefreshTokenModel => ({
  tokenHash: hashText(refreshToken),
  createdAt: dayjs().toISOString(),
  userAgent: userAgent,
  expiresAt: expires?.toISOString() || null,
});
