import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { scaleAnimation } from '@shared/animations/scale-animation';
import { asyncScheduler, Subscription } from 'rxjs';

@Component({
  selector: 'libc-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  animations: [scaleAnimation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toast {
  private readonly toastState = inject(toastStateToken);
  protected readonly message = this.toastState.state.message;
  protected readonly timeout = this.toastState.state.timeout;

  constructor() {
    let scheduler: Subscription;

    effect(() => {
      if (this.message()) {
        if (scheduler) scheduler.unsubscribe();

        scheduler = asyncScheduler.schedule(() => {
          this.toastState.setState('message', initialToastState.message);
          this.toastState.setState('timeout', initialToastState.timeout);
          scheduler.unsubscribe();
        }, this.timeout());
      }
    });
  }
}
