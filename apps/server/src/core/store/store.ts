import { debugLog } from '@server/core/logger';
import { StoreDataModel, StoreModel } from '@server/core/store/store-model';
import { filter, Observable, take, tap } from 'rxjs';

const store = (): StoreModel => global.__serverStorage;

export const Store = {
  get$: <K extends keyof StoreModel>(key: K): Observable<StoreDataModel[K]> => {
    debugLog(`Getting store value (${key})`);
    const subject = store()[key];
    return subject.asObservable() as Observable<StoreDataModel[K]>;
  },
  getLastValue: <K extends keyof StoreDataModel>(key: K): StoreDataModel[K] => {
    debugLog(`Getting last store value (${key})`);
    return store()[key].value;
  },
  getOnce$: <K extends keyof StoreModel>(key: K): Observable<StoreDataModel[K]> =>
    Store.get$(key).pipe(
      filter((value) => value !== null),
      tap(() => debugLog(`Getting store value once (${key})`)),
      take(1)
    ),
  set: <K extends keyof StoreModel>(key: K, value: StoreDataModel[K]): StoreDataModel[K] => {
    debugLog(`Setting store value (${key})`);
    const subject = store()[key];
    subject.next(value);
    return value;
  },
  reset: <K extends keyof StoreModel>(key: K): void => {
    debugLog(`Resetting store value (${key})`);
    const subject = store()[key];
    subject.next(null);
  },
  resetAll: (): void => {
    debugLog(`Resetting all store values`);
    for (const key in store()) {
      Store.reset(key as keyof StoreModel);
    }
  },
};
