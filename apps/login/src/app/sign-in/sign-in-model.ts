import { Themes } from '@services/theme/theme-model';

export interface SignInModel {
  username: string;
  token: string;
  apiUrl: string;
  language: string;
  theme: Themes;
}
