import dayjs from 'dayjs';
import { CookieOptions } from 'express';

export const cookieConfig = (): CookieOptions => ({
  httpOnly: true,
  secure: true,
  signed: true,
  sameSite: 'strict',
  expires: dayjs().add(1, 'year').toDate(),
});
