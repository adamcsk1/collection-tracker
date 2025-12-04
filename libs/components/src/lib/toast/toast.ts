import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { asyncScheduler, Subscription } from 'rxjs';

@Component({
  selector: 'libc-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toast {
  private readonly toastState = inject(toastStateToken);
  private scheduler?: Subscription;
  protected readonly message = this.toastState.state.message;
  protected readonly timeout = this.toastState.state.timeout;

  constructor() {
    effect(() => {
      if (this.message()) {
        if (this.scheduler) this.scheduler.unsubscribe();

        this.scheduler = asyncScheduler.schedule(() => this.hide(), this.timeout());
      }
    });
  }

  protected onToastClick(): void {
    this.hide();
  }

  protected hide(): void {
    this.toastState.setState('message', initialToastState.message);
    this.toastState.setState('timeout', initialToastState.timeout);
    this.scheduler?.unsubscribe();
  }
}
