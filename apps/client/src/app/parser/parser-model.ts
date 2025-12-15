import { ParserCacheModel } from '@services/parser/parser-model';

export type ParserModel = {
  [key in keyof ParserCacheModel]: string;
};

export interface TemplateRefreshStateModel {
  running: boolean;
  count: number;
  checked: number;
  errors: number;
}
