import { Injectable } from '@angular/core';
import { WebStorageTypes } from '@services/webstorage/webstorage-model';

@Injectable({
  providedIn: 'root',
})
export class WebstorageService {
  public getItem(key: string): string | null {
    const value = sessionStorage.getItem(key);
    return value ?? localStorage.getItem(key);
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
