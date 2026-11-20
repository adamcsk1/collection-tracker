import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { AvatarCacheStore } from '@services/profile/avatar-cache-store';
import { ProfileStore } from '@services/profile/profile-store';

@Component({
  selector: 'libc-avatar',
  templateUrl: './avatar.html',
  styleUrl: './avatar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  private readonly cache = inject(AvatarCacheStore);
  private readonly profile = inject(ProfileStore);
  public readonly shareCode = input('');
  public readonly revision = input<string | null>(null);
  public readonly name = input.required<string>();
  protected readonly initial = computed(() => Array.from(this.name().trim())[0]?.toUpperCase() || '?');
  protected readonly url = signal<string | null>(null);

  constructor() {
    effect((cleanup) => {
      const viewer = this.profile.profile();
      const shareCode = this.shareCode();
      const revision = this.revision();
      this.url.set(null);
      if (!viewer || !shareCode || !revision) return;
      const subscription = this.cache.load(shareCode, revision).subscribe((url) => this.url.set(url));
      cleanup(() => subscription.unsubscribe());
    });
  }
}
