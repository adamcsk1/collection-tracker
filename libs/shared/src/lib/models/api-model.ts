import { LanguageModel } from '@shared/models/language-model';
import { SearchModeModel } from '@shared/models/search-mode-model';
import { ThemeModel } from '@shared/models/theme-model';

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
  expiresAt: string | null;
}

export type AccessTokensApiResponseModel = Array<AccessTokenModel>;

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
  mdTemplate?: string;
}

export type ParserConfigApiRequestModel = ParserConfigApiResponseModel;

export interface UserSettingsApiResponseModel {
  fetchBatchSize?: number;
  theme?: ThemeModel;
  animatedBackground?: boolean;
  language?: LanguageModel;
  searchMode?: SearchModeModel;
}

export type UserSettingsApiRequestModel = UserSettingsApiResponseModel;

export interface TagConfigApiModel {
  tag: string;
  color: string;
  useForImageBorder: boolean;
  useForTextColor: boolean;
  useForImageBadge: boolean;
  weight: number;
}

export type TagConfigsApiResponseModel = Array<TagConfigApiModel>;
export type TagConfigsApiRequestModel = TagConfigsApiResponseModel;
