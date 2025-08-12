import { StoreDataModel, StoreModel } from '@server/core/store/store-model';
import { filter, Observable, take } from 'rxjs';

const store = (): StoreModel => global.__serverStorage;

export const Store = {
  get$: <K extends keyof StoreModel>(key: K): Observable<StoreDataModel[K]> => {
    const subject = store()[key];
    return subject.asObservable() as Observable<StoreDataModel[K]>;
  },
  getLastValue: <K extends keyof StoreDataModel>(key: K): StoreDataModel[K] => store()[key].value,
  getOnce$: <K extends keyof StoreModel>(key: K): Observable<StoreDataModel[K]> =>
    Store.get$(key).pipe(
      filter((value) => value !== null),
      take(1)
    ),
  set: <K extends keyof StoreModel>(key: K, value: StoreDataModel[K]): StoreDataModel[K] => {
    const subject = store()[key];
    subject.next(value);
    return value;
  },
  reset: <K extends keyof StoreModel>(key: K): void => {
    const subject = store()[key];
    subject.next(null);
  },
  resetAll: (): void => {
    for (const key in store()) {
      Store.reset(key as keyof StoreModel);
    }
  },
};
