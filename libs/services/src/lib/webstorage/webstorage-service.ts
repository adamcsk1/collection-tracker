import { Injectable } from '@angular/core';
import { WebStorageTypes } from '@services/webstorage/webstorage-model';

@Injectable({
  providedIn: 'root',
})
export class WebstorageService {
  public getItem(key: string, storage: WebStorageTypes | null = null): string | null {
    if (storage === 'session') return sessionStorage.getItem(key);
    else if (storage === 'local') return localStorage.getItem(key);
    else return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  }

  public setItem(key: string, value: string, storage: WebStorageTypes = 'local'): void {
    if (storage === 'session') sessionStorage.setItem(key, value);
    else localStorage.setItem(key, value);
  }

  public removeItem(key: string, storage: WebStorageTypes | null = null): void {
    if (storage === 'session' || storage === null) sessionStorage.removeItem(key);
    if (storage === 'local' || storage === null) localStorage.removeItem(key);
  }

  public clear(storage: WebStorageTypes | null = null): void {
    if (storage === 'session' || storage === null) sessionStorage.clear();
    if (storage === 'local' || storage === null) localStorage.clear();
  }
}
