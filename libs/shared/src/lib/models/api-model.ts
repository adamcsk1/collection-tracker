export interface GetAllApiResponseItemModel {
  name: string;
  content: string;
}

export type GetAllApiResponseModel = Array<GetAllApiResponseItemModel>;

export interface CreateApiRequestModel {
  content: string;
}

export interface CreateApiResponseModel {
  name: string;
}

export interface ModifyApiRequestModel {
  content: string;
}

export interface ChangeTokenApiResponseModel {
  newToken: string;
}

export interface SignInApiRequestModel {
  username: string;
  token: string;
}

export interface SignUpApiRequestModel {
  username: string;
}

export interface SignUpApiResponseModel {
  token: string;
}

export interface AccessTokenModel {
  tokenHash: string;
  createdAt: string;
  userAgent: string;
  expiredAt: string | null;
}

export type AccessTokensResponseModel = Array<AccessTokenModel>;

export interface CreateAccessTokenApiResponseModel {
  accessToken: string;
}
