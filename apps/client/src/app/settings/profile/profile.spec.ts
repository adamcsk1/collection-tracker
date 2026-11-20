import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { AvatarCacheStore } from '@services/profile/avatar-cache-store';
import { ProfileStore } from '@services/profile/profile-store';
import { UserProfileApiResponseModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Profile } from './profile';

const savedProfile: UserProfileApiResponseModel = {
  userShareCode: 'viewer',
  username: 'username',
  displayName: 'Saved',
  avatarRevision: null,
};

describe('Profile editor', () => {
  let fixture: ComponentFixture<Profile>;
  let component: Profile;
  let store: ProfileStore;
  const api = { getUserProfile: vi.fn(), saveUserProfile: vi.fn(), saveUserAvatar: vi.fn(), deleteUserAvatar: vi.fn() };

  beforeEach(async () => {
    Object.values(api).forEach((method) => method.mockReset().mockReturnValue(of(savedProfile)));
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: AvatarCacheStore, useValue: { load: () => of(null) } },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
      ],
    });
    store = TestBed.inject(ProfileStore);
    store.setProfile(savedProfile);
    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('loads the profile in the existing account editor and saves a trimmed display name', async () => {
    expect(fixture.nativeElement.querySelector('[data-test-id="profile-name"]').textContent).toContain('Saved');
    component['model'].set({ displayName: '  New name  ' });
    api.saveUserProfile.mockReturnValue(of({ ...savedProfile, displayName: 'New name' }));
    component['onSave']();
    expect(api.saveUserProfile).toHaveBeenCalledWith({ displayName: 'New name' });
    expect(store.profile()?.displayName).toBe('New name');
    await fixture.whenStable();
    expect(component['error']()).toBe('');
  });

  it('keeps the old profile and editable draft on failure, then permits retry and clearing', () => {
    component['model'].set({ displayName: 'Draft' });
    api.saveUserProfile.mockReturnValueOnce(throwError(() => new Error('failed')));
    component['onSave']();
    expect(store.profile()).toEqual(savedProfile);
    expect(component['model']().displayName).toBe('Draft');
    expect(component['error']()).toBe('Profile.SaveError');
    expect(component['busy']()).toBe(false);
    component['model'].set({ displayName: '   ' });
    api.saveUserProfile.mockReturnValue(of({ ...savedProfile, displayName: null }));
    component['onSave']();
    expect(api.saveUserProfile).toHaveBeenLastCalledWith({ displayName: null });
    expect(component['name']()).toBe('username');
  });

  it('blocks duplicate requests and names longer than 80 characters', async () => {
    component['model'].set({ displayName: 'x'.repeat(81) });
    await fixture.whenStable();
    component['onSave']();
    expect(api.saveUserProfile).not.toHaveBeenCalled();
    component['model'].set({ displayName: 'Valid' });
    await fixture.whenStable();
    api.saveUserProfile.mockReturnValue(new Subject<UserProfileApiResponseModel>());
    component['onSave']();
    component['onSave']();
    expect(api.saveUserProfile).toHaveBeenCalledOnce();
  });

  it('counts Unicode characters like the API and rejects control characters', async () => {
    component['model'].set({ displayName: '🐈'.repeat(80) });
    await fixture.whenStable();
    expect(component['form']().invalid()).toBe(false);
    component['model'].set({ displayName: 'Name\u0000' });
    await fixture.whenStable();
    expect(component['form']().invalid()).toBe(true);
  });

  it('rejects unsupported and oversized files without replacing the profile', async () => {
    for (const file of [
      new File(['text'], 'photo.svg', { type: 'image/svg+xml' }),
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'photo.png', { type: 'image/png' }),
    ]) {
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [file] });
      await component['onSelect']({ target: input } as unknown as Event);
      expect(component['error']()).toBe('Profile.InvalidImage');
      expect(component['preview']()).toBeNull();
      expect(store.profile()).toEqual(savedProfile);
    }
  });

  it('previews raw base64 uploads and preserves the current avatar and preview after failure', async () => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [new File(['image'], 'photo.png', { type: 'image/png' })] });
    await component['onSelect']({ target: input } as unknown as Event);
    expect(component['preview']()).toBe('data:image/png;base64,aW1hZ2U=');
    api.saveUserAvatar.mockReturnValueOnce(throwError(() => new Error('invalid image')));
    component['onUpload']();
    expect(api.saveUserAvatar).toHaveBeenCalledWith({ imageBase64: 'aW1hZ2U=' });
    expect(store.profile()).toEqual(savedProfile);
    expect(component['preview']()).not.toBeNull();
    api.saveUserAvatar.mockReturnValue(of({ ...savedProfile, avatarRevision: 'new' }));
    component['onUpload']();
    expect(component['preview']()).toBeNull();
    expect(store.profile()?.avatarRevision).toBe('new');
    component['onRemove']();
    expect(api.deleteUserAvatar).toHaveBeenCalledOnce();
    expect(store.profile()?.avatarRevision).toBeNull();
  });

  it('loads an absent profile, reports load failure and retries', async () => {
    store.reset();
    api.getUserProfile.mockReturnValueOnce(throwError(() => new Error('offline')));
    component.ngOnInit();
    await fixture.whenStable();
    expect(store.loadError()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-test-id="profile-retry"]')).not.toBeNull();
    component['onRetry']();
    expect(store.profile()).toEqual(savedProfile);
  });

  it('preserves an unsaved display name through avatar upload and removal', async () => {
    component['model'].set({ displayName: 'Unsaved name' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [new File(['image'], 'photo.png', { type: 'image/png' })] });
    await component['onSelect']({ target: input } as unknown as Event);
    api.saveUserAvatar.mockReturnValue(of({ ...savedProfile, avatarRevision: 'new' }));
    component['onUpload']();
    await fixture.whenStable();
    expect(component['model']().displayName).toBe('Unsaved name');
    expect(store.profile()?.displayName).toBe('Saved');
    component['onRemove']();
    await fixture.whenStable();
    expect(component['model']().displayName).toBe('Unsaved name');
    expect(store.profile()?.avatarRevision).toBeNull();
    api.saveUserProfile.mockReturnValue(of({ ...savedProfile, displayName: 'Unsaved name' }));
    component['onSave']();
    await fixture.whenStable();
    expect(store.profile()?.displayName).toBe('Unsaved name');
  });

  it('normalizes the display-name draft even when the saved name has not changed', async () => {
    component['model'].set({ displayName: '  Saved  ' });
    component['onSave']();
    await fixture.whenStable();
    expect(component['model']().displayName).toBe('Saved');
  });
});
