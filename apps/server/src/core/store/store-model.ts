import { ParserConfigsModel } from '@server/models/parser-config-model';
import { TagConfigsModel } from '@server/models/tag-configs-model';
import { UserSettingsMapModel } from '@server/models/user-settings-model';
import { UsersModel } from '@server/models/users-model';
import { BehaviorSubject } from 'rxjs';

export interface StoreDataModel {
  dataFolder: string | null;
  users: UsersModel | null;
  parserConfigs: ParserConfigsModel | null;
  tagConfigs: TagConfigsModel | null;
  userSettings: UserSettingsMapModel | null;
  cache: { [key: string]: string; };
  fileHashes: { [key: string]: string; };
}

export type StoreModel<T = StoreDataModel> = {
  [K in keyof T]: BehaviorSubject<T[K]>;
};
