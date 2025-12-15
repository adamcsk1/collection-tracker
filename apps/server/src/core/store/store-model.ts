import { ParserConfigsModel } from '@server/models/parser-config-model';
import { UsersModel } from '@server/models/users-model';
import type { Application } from 'express';
import { BehaviorSubject } from 'rxjs';

export interface StoreDataModel {
  app: Application | null;
  dataFolder: string | null;
  users: UsersModel | null;
  parserConfigs: ParserConfigsModel | null;
  cache: { [key: string]: string };
}

export type StoreModel<T = StoreDataModel> = {
  [K in keyof T]: BehaviorSubject<T[K]>;
};
