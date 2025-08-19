import dayjs, { ManipulateType } from 'dayjs';
import { CookieOptions } from 'express';

export const cookieExpiration = {
  value: 15,
  unit: 'days',
};

export const cookieConfig = (): CookieOptions => ({
  httpOnly: true,
  secure: true,
  signed: true,
  sameSite: 'strict',
  expires: dayjs()
    .add(cookieExpiration.value, cookieExpiration.unit as ManipulateType)
    .toDate(),
});
