import { inject, Injectable, Injector, untracked } from '@angular/core';
import { NgxSimpleSignalStoreService } from 'ngx-simple-signal-store';
import { catchError, finalize, map, Observable, of, shareReplay } from 'rxjs';
import { ApiService } from '../api/api-service';
import { apiStateToken } from '../api/api-store';
import { ProfileStore } from './profile-store';

interface AvatarCacheState {
  urls: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class AvatarCacheStore {
  private readonly injector = inject(Injector);
  private readonly store = new NgxSimpleSignalStoreService<AvatarCacheState>({ urls: {} });
  private readonly pending = new Map<string, Observable<string | null>>();
  private generation = 0;

  public load(shareCode: string, revision: string): Observable<string | null> {
    const viewer = this.injector.get(ProfileStore).profile()?.userShareCode;
    if (!viewer) return of(null);
    const key = JSON.stringify([this.injector.get(apiStateToken).state.apiUrl(), viewer, shareCode, revision]);
    const cached = untracked(this.store.state.urls)[key];
    if (cached) return of(cached);
    const pending = this.pending.get(key);
    if (pending) return pending;
    const generation = this.generation;
    const request = this.injector
      .get(ApiService)
      .getUserAvatar(shareCode)
      .pipe(
        map((blob) => {
          if (generation !== this.generation) return null;
          const urls = { ...untracked(this.store.state.urls) };
          while (Object.keys(urls).length >= 64) {
            const oldest = Object.keys(urls)[0];
            URL.revokeObjectURL(urls[oldest]);
            delete urls[oldest];
          }
          const url = URL.createObjectURL(blob);
          this.store.setState('urls', { ...urls, [key]: url });
          return url;
        }),
        catchError(() => of(null)),
        finalize(() => {
          if (generation === this.generation) this.pending.delete(key);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    this.pending.set(key, request);
    return request;
  }

  public reset(): void {
    ++this.generation;
    Object.values(this.store.state.urls()).forEach((url) => URL.revokeObjectURL(url));
    this.store.resetStore();
    this.pending.clear();
  }
}
