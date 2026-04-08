import { ParserConfigsModel } from '../../models/parser-config-model';
import { UserSettingsMapModel } from '../../models/user-settings-model';
import { UsersModel } from '../../models/users-model';
import { TagConfigsApiResponseModel } from '@shared/models/api-model';
import { BehaviorSubject } from 'rxjs';

export interface StoreDataModel {
  dataFolder: string | null;
  users: UsersModel | null;
  parserConfigs: ParserConfigsModel | null;
  tagConfigs: TagConfigsApiResponseModel | null;
  userSettings: UserSettingsMapModel | null;
  cache: { [key: string]: string };
  fileHashes: { [key: string]: string };
}

export type StoreModel<T = StoreDataModel> = {
  [K in keyof T]: BehaviorSubject<T[K]>;
};
