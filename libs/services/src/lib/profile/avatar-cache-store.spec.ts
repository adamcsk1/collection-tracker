import { TestBed } from '@angular/core/testing';
import { provideStore } from 'ngx-simple-signal-store';
import { lastValueFrom, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../api/api-service';
import { apiStateToken, initialApiState } from '../api/api-store';
import { AvatarCacheStore } from './avatar-cache-store';
import { ProfileStore } from './profile-store';

describe('AvatarCacheStore', () => {
  let cache: AvatarCacheStore;
  let profile: ProfileStore;
  const api = { getUserAvatar: vi.fn() };
  const blob = new Blob(['photo'], { type: 'image/webp' });
  let sequence = 0;

  beforeEach(() => {
    sequence = 0;
    vi.stubGlobal(
      'URL',
      class extends URL {
        public static override createObjectURL = vi.fn(() => `blob:photo-${++sequence}`);
        public static override revokeObjectURL = vi.fn();
      }
    );
    api.getUserAvatar.mockReset().mockReturnValue(of(blob));
    TestBed.configureTestingModule({
      providers: [provideStore(initialApiState, apiStateToken), { provide: ApiService, useValue: api }],
    });
    cache = TestBed.inject(AvatarCacheStore);
    profile = TestBed.inject(ProfileStore);
    profile.setProfile({ userShareCode: 'viewer', username: null, displayName: null, avatarRevision: null });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('deduplicates requests and caches object URLs', async () => {
    const response = new Subject<Blob>();
    api.getUserAvatar.mockReturnValue(response);
    const first = lastValueFrom(cache.load('owner', 'revision'));
    const second = lastValueFrom(cache.load('owner', 'revision'));
    expect(api.getUserAvatar).toHaveBeenCalledTimes(1);
    response.next(blob);
    response.complete();
    expect(await first).toBe(await second);
    expect(await lastValueFrom(cache.load('owner', 'revision'))).toBe('blob:photo-1');
    expect(api.getUserAvatar).toHaveBeenCalledTimes(1);
  });

  it('separates revisions, viewers and API bases', async () => {
    await lastValueFrom(cache.load('owner', 'one'));
    await lastValueFrom(cache.load('owner', 'two'));
    profile.setProfile({ userShareCode: 'other', username: null, displayName: null, avatarRevision: null });
    await lastValueFrom(cache.load('owner', 'two'));
    TestBed.inject(apiStateToken).setState('apiUrl', 'https://other.test/api/v1');
    await lastValueFrom(cache.load('owner', 'two'));
    expect(api.getUserAvatar).toHaveBeenCalledTimes(4);
  });

  it('does not cache failures indefinitely', async () => {
    api.getUserAvatar.mockReturnValueOnce(throwError(() => new Error('offline')));
    expect(await lastValueFrom(cache.load('owner', 'one'))).toBeNull();
    expect(await lastValueFrom(cache.load('owner', 'one'))).toBe('blob:photo-1');
  });

  it('revokes URLs on eviction and logout and ignores requests from before logout', async () => {
    for (let revision = 0; revision < 65; revision++) await lastValueFrom(cache.load('owner', `${revision}`));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
    const response = new Subject<Blob>();
    api.getUserAvatar.mockReturnValue(response);
    const pending = lastValueFrom(cache.load('owner', 'pending'));
    cache.reset();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(65);
    response.next(blob);
    response.complete();
    expect(await pending).toBeNull();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(65);
  });

  it('never requests avatars without a loaded viewer', async () => {
    profile.reset();
    expect(await lastValueFrom(cache.load('owner', 'one'))).toBeNull();
    expect(api.getUserAvatar).not.toHaveBeenCalled();
  });
});
