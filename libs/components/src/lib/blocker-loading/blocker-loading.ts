import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { BLOCKER_LOADING_TIMEOUT_MS } from './blocker-loading-const';
import { blockerLoadingStateToken } from './blocker-loading-store';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { asyncScheduler, Subscription } from 'rxjs';

@Component({
  selector: 'libc-blocker-loading',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './blocker-loading.html',
  styleUrl: './blocker-loading.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockerLoading {
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  private readonly theme = inject(ThemeService);
  private startTime: number | null = null;
  private scheduler?: Subscription;
  protected readonly showBlockerLoading = signal(false);
  protected readonly message = this.blockerLoadingState.state.message;
  protected readonly themeLogo = this.theme.themeLogo;

  constructor() {
    effect(() => {
      const show = this.blockerLoadingState.state.show();
      const withoutDelay = this.blockerLoadingState.state.withoutDelay();
      if (show && !withoutDelay) {
        this.startTime = new Date().getTime();

        this.scheduler = asyncScheduler.schedule(() => {
          if (show) {
            this.showBlockerLoading.set(true);
          } else this.startTime = null;
        }, BLOCKER_LOADING_TIMEOUT_MS);
      } else if (withoutDelay) this.showBlockerLoading.set(true);

      if (!show && this.startTime) {
        this.scheduler?.unsubscribe();
        this.showBlockerLoading.set(false);
        this.blockerLoadingState.setState('message', null);
        this.startTime = null;
      } else if (!show && withoutDelay) {
        asyncScheduler.schedule(() => {
          this.showBlockerLoading.set(false);
          this.blockerLoadingState.setState('withoutDelay', false);
          this.blockerLoadingState.setState('message', null);
        }, BLOCKER_LOADING_TIMEOUT_MS);
      }
    });
  }
}
