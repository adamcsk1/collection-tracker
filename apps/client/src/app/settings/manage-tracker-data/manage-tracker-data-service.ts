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
export class ManageTrackerDataService {
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly confirm = inject(ConfirmService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly collection = inject(CollectionService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  public markAllMoviesAsWatched(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllMoviesAsWatched'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllMoviesAsWatched')
        );

        this.api
          .markAllMoviesAsWatched(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.MarkedAllMoviesAsWatched'));
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('timeout', 10000);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllMoviesAsWatchedWithErrors')
              );
            },
          });
      });
  }

  public markAllMoviesAsUnwatched(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllMoviesAsUnwatched'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllMoviesAsUnwatched')
        );

        this.api
          .markAllMoviesAsUnwatched(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkedAllMoviesAsUnwatched')
              );
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllMoviesAsUnwatchedWithErrors')
              );
            },
          });
      });
  }

  public markAllSeriesAsWatched(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllSeriesAsWatched'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllSeriesAsWatched')
        );

        this.api
          .markAllSeriesAsWatched(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.MarkedAllSeriesAsWatched'));
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('timeout', 10000);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllSeriesAsWatchedWithErrors')
              );
            },
          });
      });
  }

  public markAllSeriesAsUnwatched(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllSeriesAsUnwatched'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllSeriesAsUnwatched')
        );

        this.api
          .markAllSeriesAsUnwatched(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkedAllSeriesAsUnwatched')
              );
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllSeriesAsUnwatchedWithErrors')
              );
            },
          });
      });
  }

  public removeAllTrackedMovieData(): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.RemoveAllTrackedMovieData'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.RemovingTrackedMovieData')
        );

        this.api
          .deleteAllMovieTrackerItems()
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.RemovedTrackedMovieData'));
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.RemovingTrackedMovieDataWithErrors')
              );
            },
          });
      });
  }

  public removeAllTrackedSeriesData(): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.RemoveAllTrackedSeriesData'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.RemovingTrackedSeriesData')
        );

        this.api
          .deleteAllSeriesTrackerItems()
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.RemovedTrackedSeriesData'));
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.RemovingTrackedSeriesDataWithErrors')
              );
            },
          });
      });
  }

  public removeAllTrackedBookData(): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.RemoveAllTrackedBookData'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.RemovingTrackedBookData')
        );

        this.api
          .deleteAllBookTrackerItems()
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.RemovedTrackedBookData'));
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.RemovingTrackedBookDataWithErrors')
              );
            },
          });
      });
  }
}
