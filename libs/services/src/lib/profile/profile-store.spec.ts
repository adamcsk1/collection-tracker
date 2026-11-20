import { TestBed } from '@angular/core/testing';
import { ApiService } from '../api/api-service';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileStore } from './profile-store';
import { UserProfileApiResponseModel } from '@shared/models/api-model';

const profile: UserProfileApiResponseModel = {
  userShareCode: 'viewer',
  username: 'User',
  displayName: null,
  avatarRevision: null,
};

describe('ProfileStore', () => {
  let store: ProfileStore;
  const api = { getUserProfile: vi.fn() };

  beforeEach(() => {
    api.getUserProfile.mockReturnValue(of(profile));
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
    store = TestBed.inject(ProfileStore);
  });

  it('loads the session profile and keeps it memory-only', () => {
    store.load();
    expect(store.profile()).toEqual(profile);
    expect(store.loadError()).toBe(false);
    store.reset();
    expect(store.profile()).toBeNull();
  });

  it('preserves the current profile on a failed refresh and allows retry', () => {
    store.setProfile(profile);
    api.getUserProfile.mockReturnValue(throwError(() => new Error('offline')));
    store.load();
    expect(store.profile()).toEqual(profile);
    expect(store.loadError()).toBe(true);
    api.getUserProfile.mockReturnValue(of({ ...profile, displayName: 'New name' }));
    store.load();
    expect(store.profile()?.displayName).toBe('New name');
    expect(store.loadError()).toBe(false);
  });

  it('ignores responses from before logout or a newer save', () => {
    const response = new Subject<UserProfileApiResponseModel>();
    api.getUserProfile.mockReturnValue(response);
    store.load();
    store.reset();
    response.next(profile);
    expect(store.profile()).toBeNull();
    store.load();
    store.setProfile({ ...profile, displayName: 'Saved' });
    response.next(profile);
    expect(store.profile()?.displayName).toBe('Saved');
  });
});
