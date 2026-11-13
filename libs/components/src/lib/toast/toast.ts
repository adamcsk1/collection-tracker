import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { initialToastState, toastStateToken } from './toast-store';
import { asyncScheduler, Subscription } from 'rxjs';

@Component({
  selector: 'libc-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toast {
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly translations = { close: computed(() => this.ngxSignalTranslate.translate('Close')) };
  private scheduler?: Subscription;
  private dismissFocused = false;
  private expired = false;
  protected readonly message = this.toastState.state.message;
  protected readonly timeout = this.toastState.state.timeout;

  constructor() {
    effect(() => {
      if (this.message()) {
        if (this.scheduler) this.scheduler.unsubscribe();
        this.expired = false;

        this.scheduler = asyncScheduler.schedule(() => {
          if (this.dismissFocused) this.expired = true;
          else this.hide();
        }, this.timeout());
      }
    });
  }

  protected onToastClick(): void {
    this.hide();
  }

  protected onDismissFocus(): void {
    this.dismissFocused = true;
  }

  protected onDismissBlur(): void {
    this.dismissFocused = false;
    if (this.expired) this.hide();
  }

  protected hide(): void {
    this.expired = false;
    this.dismissFocused = false;
    this.toastState.setState('message', initialToastState.message);
    this.toastState.setState('timeout', initialToastState.timeout);
    this.scheduler?.unsubscribe();
  }
}
