import { inject, Injectable, Injector } from '@angular/core';
import { UserProfileApiResponseModel } from '@shared/models/api-model';
import { NgxSimpleSignalStoreService } from 'ngx-simple-signal-store';
import { ApiService } from '../api/api-service';

interface ProfileState {
  profile: UserProfileApiResponseModel | null;
  loadError: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly injector = inject(Injector);
  private readonly store = new NgxSimpleSignalStoreService<ProfileState>({ profile: null, loadError: false });
  private generation = 0;
  public readonly profile = this.store.state.profile;
  public readonly loadError = this.store.state.loadError;

  public load(): void {
    const generation = ++this.generation;
    this.store.setState('loadError', false);
    this.injector
      .get(ApiService)
      .getUserProfile()
      .subscribe({
        next: (profile) => {
          if (generation === this.generation) this.setProfile(profile);
        },
        error: () => {
          if (generation === this.generation) this.store.setState('loadError', true);
        },
      });
  }

  public setProfile(profile: UserProfileApiResponseModel): void {
    ++this.generation;
    this.store.setState('profile', profile);
    this.store.setState('loadError', false);
  }

  public reset(): void {
    ++this.generation;
    this.store.resetStore();
  }
}
