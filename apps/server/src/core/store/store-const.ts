import { StoreDataModel } from './store-model';

export const STORE_KEYS = [
  'dataFolder',
  'users',
  'parserConfigs',
  'tagConfigs',
  'userSettings',
  'cache',
  'fileHashes',
] as const satisfies readonly (keyof StoreDataModel)[];
