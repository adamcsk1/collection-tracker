import { StoreModel } from './store-model';
import { BehaviorSubject } from 'rxjs';

const initialStore = (): StoreModel => ({
  dataFolder: new BehaviorSubject(null),
  users: new BehaviorSubject(null),
  parserConfigs: new BehaviorSubject(null),
  tagConfigs: new BehaviorSubject(null),
  userSettings: new BehaviorSubject(null),
  cache: new BehaviorSubject({}),
  fileHashes: new BehaviorSubject({}),
});

if (!global.__serverStorage) global.__serverStorage = initialStore();
