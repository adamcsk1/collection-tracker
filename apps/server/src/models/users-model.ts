import { AccessTokenModel, RefreshTokenModel } from '@shared/models/api-model';

export interface UserModel {
  accessTokens: AccessTokenModel[];
  refreshTokens: RefreshTokenModel[];
  userTokenHash: string;
}

export type UsersModel = Record<string, UserModel>;
