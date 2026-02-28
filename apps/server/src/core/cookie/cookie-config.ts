import dayjs, { ManipulateType } from 'dayjs';
import { CookieOptions } from 'express';

export const cookieExpiration = {
  value: 15,
  unit: 'days',
} satisfies { value: number; unit: ManipulateType };

export const cookieConfig = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  signed: true,
  sameSite: 'strict',
  expires: dayjs().add(cookieExpiration.value, cookieExpiration.unit).toDate(),
});
