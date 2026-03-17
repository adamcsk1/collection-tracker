import { LanguageModel } from '@shared/models/language-model';
import { ThemeModel } from '@shared/models/theme-model';

export interface GetAllApiResponseItemModel {
  name: string;
  content: string;
}

export type GetAllApiResponseModel = GetAllApiResponseItemModel[];

export interface CreateApiRequestModel {
  content: string;
  name: string;
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
  expiresAt: string | null;
}

export type AccessTokensApiResponseModel = AccessTokenModel[];

export interface CreateAccessTokenApiResponseModel {
  accessToken: string;
}
export interface ParserConfigApiResponseModel {
  IMDbId?: string;
  genre?: string;
  genreToken?: string;
  image?: string;
  IMDbRate?: string;
  tags?: string;
  tagToken?: string;
  title?: string;
  year?: string;
  content?: string;
  mdTemplate?: string;
  filenamePattern?: string;
}

export type ParserConfigApiRequestModel = ParserConfigApiResponseModel;

export interface UserSettingsApiResponseModel {
  fetchBatchSize?: number;
  theme?: ThemeModel;
  animatedBackground?: boolean;
  language?: LanguageModel;
  claudeAiAvailable?: boolean; // This field is determined by the presence of the CLAUDE_API_KEY on the server and indicates whether Claude AI search is available for the user.
}

export type UserSettingsApiRequestModel = UserSettingsApiResponseModel;

export interface TagConfigApiModel {
  tag: string;
  color: string | null;
  useForImageBorder: boolean;
  useForTextColor: boolean;
  useForImageBadge: boolean;
  weight: number;
}

export type TagConfigsApiResponseModel = TagConfigApiModel[];
export type TagConfigsApiRequestModel = TagConfigsApiResponseModel;
