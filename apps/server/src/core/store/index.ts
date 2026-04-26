import { BehaviorSubject } from 'rxjs';
import { StoreDataModel, StoreModel } from './store-model';

declare global {
  var __serverStorage: StoreModel;
}

const initialStore = (): StoreModel => ({
  dataFolder: new BehaviorSubject<StoreDataModel['dataFolder']>(null),
  users: new BehaviorSubject<StoreDataModel['users']>(null),
  parserConfigs: new BehaviorSubject<StoreDataModel['parserConfigs']>(null),
  tagConfigs: new BehaviorSubject<StoreDataModel['tagConfigs']>(null),
  userSettings: new BehaviorSubject<StoreDataModel['userSettings']>(null),
  cache: new BehaviorSubject<StoreDataModel['cache']>({}),
  fileHashes: new BehaviorSubject<StoreDataModel['fileHashes']>({}),
});

if (!global.__serverStorage) global.__serverStorage = initialStore();
