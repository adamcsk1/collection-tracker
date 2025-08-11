import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { scaleAnimation } from '@shared/animations/scale-animation';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { concatMap, delay, filter, of, tap } from 'rxjs';

@Component({
  selector: 'ct-spinner-loading',
  imports: [AsyncPipe, NgxSignalTranslatePipe],
  templateUrl: './spinner-loading.html',
  styleUrl: './spinner-loading.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [scaleAnimation],
})
export class SpinnerLoading {
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private counter = 0;
  protected readonly spinnerLoading$ = toObservable(this.spinnerLoadingState.state.show).pipe(
    tap((status) => {
      if (status) this.counter++;
      else this.counter--;
    }),
    concatMap((status) =>
      status
        ? of(true)
        : of(false).pipe(
            filter(() => this.counter === 0),
            delay(250)
          )
    )
  );
}
