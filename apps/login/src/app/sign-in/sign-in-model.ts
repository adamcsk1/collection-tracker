import { LanguageModel } from '@shared/models/language-model';
import { ThemeModel } from '@shared/models/theme-model';

export interface SignInModel {
  username: string;
  token: string;
  apiUrl: string;
  language: LanguageModel;
  theme: ThemeModel;
}
