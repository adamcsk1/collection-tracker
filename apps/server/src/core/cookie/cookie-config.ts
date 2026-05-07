import dayjs, { ManipulateType } from 'dayjs';
import type { FastifyCookieOptions } from '@fastify/cookie';

export const accessCookieExpiration = {
  value: 15,
  unit: 'minutes',
} satisfies { value: number; unit: ManipulateType };

export const refreshCookieExpiration = {
  value: 7,
  unit: 'days',
} satisfies { value: number; unit: ManipulateType };

export const accessCookieConfig = (): FastifyCookieOptions['parseOptions'] => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  signed: true,
  sameSite: 'strict',
  expires: dayjs().add(accessCookieExpiration.value, accessCookieExpiration.unit).toDate(),
});

export const refreshCookieConfig = (): FastifyCookieOptions['parseOptions'] => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  signed: true,
  sameSite: 'strict',
  expires: dayjs().add(refreshCookieExpiration.value, refreshCookieExpiration.unit).toDate(),
});
