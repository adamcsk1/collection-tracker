import { Component, effect, inject } from '@angular/core';
import { scaleAnimation } from '@lib/animations/scale-animation';
import { initialToastState, toastStateToken } from '@lib/components/toast/toast-store';
import { asyncScheduler, Subscription } from 'rxjs';

@Component({
  selector: 'ct-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  animations: [scaleAnimation],
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
