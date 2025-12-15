import { StoreModel } from '@server/core/store/store-model';
import { BehaviorSubject } from 'rxjs';

const initialStore = () =>
  ({
    app: new BehaviorSubject(null),
    dataFolder: new BehaviorSubject(null),
    users: new BehaviorSubject(null),
    parserConfigs: new BehaviorSubject(null),
    cache: new BehaviorSubject({}),
  }) as StoreModel;

if (!global.__serverStorage) global.__serverStorage = initialStore();
