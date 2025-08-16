export interface UserModel {
  accessTokenHashes: string[];
  userTokenHash: string;
}

export type UsersModel = Record<string, UserModel>;
