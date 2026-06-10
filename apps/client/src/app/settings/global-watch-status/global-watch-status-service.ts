import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { take } from 'rxjs';
import { CollectionService } from '../../collection/collection-service';

@Injectable()
export class GlobalWatchStatusService {
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly confirm = inject(ConfirmService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly collection = inject(CollectionService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  public markAllAsWatched(): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllAsWatched'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllAsWatched')
        );

        this.api
          .markAllAsWatched()
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.MarkedAllAsWatched'));
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('timeout', 10000);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllAsWatchedWithErrors')
              );
            },
          });
      });
  }

  public markAllAsUnwatched(): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllAsUnwatched'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllAsUnwatched')
        );

        this.api
          .markAllAsUnwatched()
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.MarkedAllAsUnwatched'));
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllAsWatchedWithErrors')
              );
            },
          });
      });
  }
}
