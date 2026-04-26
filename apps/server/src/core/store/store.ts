import { debugLog } from '../logger';
import { STORE_KEYS } from './store-const';
import { StoreDataModel, StoreModel } from './store-model';
import { filter, Observable, take, tap } from 'rxjs';

const store = (): StoreModel => global.__serverStorage;

export const Store = {
  get$: <K extends keyof StoreDataModel>(key: K): Observable<StoreDataModel[K]> => {
    debugLog(`Getting store value (${key})`);
    const subject = store()[key];
    return subject.asObservable();
  },
  getLastValue: <K extends keyof StoreDataModel>(key: K): StoreDataModel[K] => {
    debugLog(`Getting last store value (${key})`);
    return structuredClone(store()[key].value);
  },
  getOnce$: <K extends keyof StoreDataModel>(key: K): Observable<StoreDataModel[K]> =>
    Store.get$(key).pipe(
      filter((value) => value !== null),
      tap(() => debugLog(`Getting store value once (${key})`)),
      take(1)
    ),
  set: <K extends keyof StoreDataModel>(key: K, value: StoreDataModel[K]): StoreDataModel[K] => {
    debugLog(`Setting store value (${key})`);
    const subject = store()[key];
    subject.next(value);
    return value;
  },
  reset: <K extends keyof StoreDataModel>(key: K): void => {
    debugLog(`Resetting store value (${key})`);
    const subject = store()[key];
    const emptyValue: StoreDataModel[K] =
      key === 'cache' || key === 'fileHashes' ? ({} as StoreDataModel[K]) : (null as StoreDataModel[K]);
    subject.next(emptyValue);
  },
  resetAll: (): void => {
    debugLog(`Resetting all store values`);
    for (const key of STORE_KEYS) {
      Store.reset(key);
    }
  },
};
