export interface UserModel {
  accessTokenHash: string;
}

export type UsersModel = Record<string, UserModel>;
