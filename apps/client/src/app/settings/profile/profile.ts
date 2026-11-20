import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, validate } from '@angular/forms/signals';
import { Avatar } from '@components/avatar/avatar';
import { Input } from '@components/input/input';
import { ApiService } from '@services/api/api-service';
import { ProfileStore } from '@services/profile/profile-store';
import { UserProfileApiResponseModel } from '@shared/models/api-model';
import { USER_AVATAR_MAX_BYTES, USER_PROFILE_DISPLAY_NAME_MAX_LENGTH } from '@shared/constants/user-profile-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { finalize, Observable } from 'rxjs';

@Component({
  selector: 'ct-profile',
  imports: [Avatar, Input, FormField],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile implements OnInit {
  private readonly store = inject(ProfileStore);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(NgxSignalTranslateService);
  protected readonly profile = this.store.profile;
  protected readonly loadError = this.store.loadError;
  protected readonly model = signal({ displayName: '' });
  protected readonly form = form(this.model, (path) =>
    validate(path.displayName, ({ value }) =>
      Array.from(value().trim()).length > USER_PROFILE_DISPLAY_NAME_MAX_LENGTH || /\p{Cc}/u.test(value())
        ? { kind: 'displayName' }
        : null
    )
  );
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly preview = signal<string | null>(null);
  private selectedImage: string | null = null;
  protected readonly name = computed(() => {
    const profile = this.profile();
    return profile?.displayName || profile?.username || profile?.userShareCode || '';
  });
  protected readonly translations = {
    title: computed(() => this.translate.translate('Profile.Title')),
    displayName: computed(() => this.translate.translate('Profile.DisplayName')),
    invalidName: computed(() => this.translate.translate('Profile.InvalidName')),
    username: computed(() => this.translate.translate('Profile.Username')),
    avatar: computed(() => this.translate.translate('Profile.Avatar')),
    upload: computed(() => this.translate.translate('Profile.Upload')),
    remove: computed(() => this.translate.translate('Profile.Remove')),
    help: computed(() => this.translate.translate('Profile.Help')),
    save: computed(() => this.translate.translate('Save')),
    retry: computed(() => this.translate.translate('Profile.Retry')),
    loadError: computed(() => this.translate.translate('Profile.LoadError')),
    loading: computed(() => this.translate.translate('Message.Loading')),
  };

  constructor() {
    const displayName = computed(() => this.profile()?.displayName ?? '');
    effect(() => {
      this.model.set({ displayName: displayName() });
    });
  }

  public ngOnInit(): void {
    if (!this.profile()) this.store.load();
  }

  protected onRetry(): void {
    this.store.load();
  }

  protected onSave(): void {
    if (this.busy() || this.form().invalid()) return;
    this.save(this.api.saveUserProfile({ displayName: this.model().displayName.trim() || null }));
  }

  protected async onSelect(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy()) return;
    this.error.set('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > USER_AVATAR_MAX_BYTES) {
      this.error.set(this.translate.translate('Profile.InvalidImage'));
      return;
    }
    this.busy.set(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error()));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      if (this.destroyRef.destroyed) return;
      this.selectedImage = data.slice(data.indexOf(',') + 1);
      this.preview.set(data);
    } catch {
      if (!this.destroyRef.destroyed) this.error.set(this.translate.translate('Profile.InvalidImage'));
    } finally {
      this.busy.set(false);
    }
  }

  protected onUpload(): void {
    if (this.busy() || !this.selectedImage) return;
    this.save(this.api.saveUserAvatar({ imageBase64: this.selectedImage }), true);
  }

  protected onRemove(): void {
    if (this.busy()) return;
    this.save(this.api.deleteUserAvatar(), true);
  }

  private save(request: Observable<UserProfileApiResponseModel>, clearPreview = false): void {
    this.busy.set(true);
    this.error.set('');
    request
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (profile) => {
          this.store.setProfile(profile);
          if (!clearPreview) this.model.set({ displayName: profile.displayName ?? '' });
          if (clearPreview) {
            this.preview.set(null);
            this.selectedImage = null;
          }
        },
        error: () => this.error.set(this.translate.translate('Profile.SaveError')),
      });
  }
}
