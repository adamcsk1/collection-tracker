import { hashText } from '@server/core/crypto';
import { DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { UsersModel } from '@server/models/users-model';
import { AccessTokenModel } from '@shared/models/api-model';
import dayjs from 'dayjs';
import { writeFileSync } from 'fs';

export const updateUsers = (users: UsersModel): void => {
  Store.set('users', users);

  writeFileSync(
    `${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`,
    JSON.stringify(users, null, 2),
    { encoding: 'utf-8' }
  );
};

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
