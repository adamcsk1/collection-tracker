import { StoreModel } from '@server/core/store/store-model';
import { BehaviorSubject } from 'rxjs';

const initialStore = (): StoreModel => ({
  dataFolder: new BehaviorSubject(null),
  users: new BehaviorSubject(null),
  parserConfigs: new BehaviorSubject(null),
  cache: new BehaviorSubject({}),
});

if (!global.__serverStorage) global.__serverStorage = initialStore();
