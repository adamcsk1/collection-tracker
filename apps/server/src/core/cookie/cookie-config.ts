import dayjs, { ManipulateType } from 'dayjs';
import { CookieConfig } from './cookie-model';

export const accessCookieExpiration = {
  value: 15,
  unit: 'minutes',
} satisfies { value: number; unit: ManipulateType };

export const refreshCookieExpiration = {
  value: 7,
  unit: 'days',
} satisfies { value: number; unit: ManipulateType };

export const accessCookieConfig = (): CookieConfig => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  signed: true,
  sameSite: 'strict',
  path: '/',
  expires: dayjs().add(accessCookieExpiration.value, accessCookieExpiration.unit).toDate(),
});

export const refreshCookieConfig = (): CookieConfig => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  signed: true,
  sameSite: 'strict',
  path: '/',
  expires: dayjs().add(refreshCookieExpiration.value, refreshCookieExpiration.unit).toDate(),
});
