import { AccessTokenModel } from '@shared/models/api-model';

export interface UserModel {
  accessTokens: Array<AccessTokenModel>;
  userTokenHash: string;
}

export type UsersModel = Record<string, UserModel>;
