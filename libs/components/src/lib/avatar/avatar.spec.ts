import { TestBed } from '@angular/core/testing';
import { AvatarCacheStore } from '@services/profile/avatar-cache-store';
import { ProfileStore } from '@services/profile/profile-store';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Avatar } from './avatar';

describe('Avatar', () => {
  const cache = { load: vi.fn() };

  beforeEach(() => {
    cache.load.mockReset().mockReturnValue(of('blob:photo'));
    TestBed.configureTestingModule({ providers: [{ provide: AvatarCacheStore, useValue: cache }] });
  });

  it('shows an accessible fallback without requesting an absent avatar', async () => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', 'User');
    fixture.componentRef.setInput('shareCode', 'owner');
    await fixture.whenStable();
    const fallback: HTMLElement = fixture.nativeElement.querySelector('[data-test-id="avatar-fallback"]');
    expect(fallback.textContent?.trim()).toBe('U');
    expect(fallback.getAttribute('aria-label')).toBe('User');
    expect(cache.load).not.toHaveBeenCalled();
  });

  it('loads an authenticated blob, changes revision, and resets on logout', async () => {
    const profile = TestBed.inject(ProfileStore);
    profile.setProfile({ userShareCode: 'viewer', username: null, displayName: null, avatarRevision: null });
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', 'Owner');
    fixture.componentRef.setInput('shareCode', 'owner');
    fixture.componentRef.setInput('revision', 'one');
    await fixture.whenStable();
    expect(cache.load).toHaveBeenCalledWith('owner', 'one');
    expect(fixture.nativeElement.querySelector('img').alt).toBe('Owner');
    fixture.componentRef.setInput('revision', 'two');
    await fixture.whenStable();
    expect(cache.load).toHaveBeenCalledWith('owner', 'two');
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    profile.reset();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-test-id="avatar-fallback"]')).not.toBeNull();
  });

  it('ignores a stale request when the target changes', async () => {
    TestBed.inject(ProfileStore).setProfile({
      userShareCode: 'viewer',
      username: null,
      displayName: null,
      avatarRevision: null,
    });
    const response = new Subject<string>();
    cache.load.mockReturnValueOnce(response);
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', 'Owner');
    fixture.componentRef.setInput('shareCode', 'owner');
    fixture.componentRef.setInput('revision', 'one');
    await fixture.whenStable();
    fixture.componentRef.setInput('revision', null);
    await fixture.whenStable();
    response.next('blob:stale');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
});
