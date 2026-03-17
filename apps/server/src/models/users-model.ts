import { AccessTokenModel } from '@shared/models/api-model';

export interface UserModel {
  accessTokens: AccessTokenModel[];
  userTokenHash: string;
}

export type UsersModel = Record<string, UserModel>;
