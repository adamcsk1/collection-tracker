import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { concatMap, delay, filter, of, skip, tap } from 'rxjs';

@Component({
  selector: 'libc-spinner-loading',
  imports: [AsyncPipe, NgxSignalTranslatePipe],
  templateUrl: './spinner-loading.html',
  styleUrl: './spinner-loading.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpinnerLoading {
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private counter = 0;
  protected readonly spinnerLoading$ = toObservable(this.spinnerLoadingState.state.show).pipe(
    skip(1),
    tap((status) => {
      if (status) this.counter++;
      else if (this.counter > 0) this.counter--;
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
