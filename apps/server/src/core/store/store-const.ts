import { StoreDataModel } from '@server/core/store/store-model';

export const STORE_KEYS = [
  'dataFolder',
  'users',
  'parserConfigs',
  'tagConfigs',
  'cache',
] as const satisfies ReadonlyArray<keyof StoreDataModel>;
