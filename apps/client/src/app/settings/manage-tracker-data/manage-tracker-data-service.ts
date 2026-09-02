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

  public markAllMoviesAsCompleted(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllMoviesAsCompleted'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllMoviesAsCompleted')
        );

        this.api
          .markAllMoviesAsCompleted(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkedAllMoviesAsCompleted')
              );
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('timeout', 10000);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllMoviesAsCompletedWithErrors')
              );
            },
          });
      });
  }

  public markAllMoviesAsUncompleted(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllMoviesAsUncompleted'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllMoviesAsUncompleted')
        );

        this.api
          .markAllMoviesAsUncompleted(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkedAllMoviesAsUncompleted')
              );
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllMoviesAsUncompletedWithErrors')
              );
            },
          });
      });
  }

  public markAllSeriesAsCompleted(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllSeriesAsCompleted'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllSeriesAsCompleted')
        );

        this.api
          .markAllSeriesAsCompleted(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkedAllSeriesAsCompleted')
              );
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('timeout', 10000);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllSeriesAsCompletedWithErrors')
              );
            },
          });
      });
  }

  public markAllSeriesAsUncompleted(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllSeriesAsUncompleted'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllSeriesAsUncompleted')
        );

        this.api
          .markAllSeriesAsUncompleted(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkedAllSeriesAsUncompleted')
              );
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllSeriesAsUncompletedWithErrors')
              );
            },
          });
      });
  }

  public markAllBooksAsCompleted(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllBooksAsCompleted'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllBooksAsCompleted')
        );

        this.api
          .markAllBooksAsCompleted(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.MarkedAllBooksAsCompleted'));
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('timeout', 10000);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllBooksAsCompletedWithErrors')
              );
            },
          });
      });
  }

  public markAllBooksAsUncompleted(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllBooksAsUncompleted'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllBooksAsUncompleted')
        );

        this.api
          .markAllBooksAsUncompleted(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkedAllBooksAsUncompleted')
              );
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllBooksAsUncompletedWithErrors')
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
          .deleteAllCompletedMovies()
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
          .deleteAllTrackingItems()
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

  public markAllMusicAsCompleted(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllMusicAsCompleted'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllMusicAsCompleted')
        );

        this.api
          .markAllMusicAsCompleted(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.MarkedAllMusicAsCompleted'));
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('timeout', 10000);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllMusicAsCompletedWithErrors')
              );
            },
          });
      });
  }

  public markAllMusicAsUncompleted(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllMusicAsUncompleted'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.MarkingAllMusicAsUncompleted')
        );

        this.api
          .markAllMusicAsUncompleted(ownerShareCode)
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkedAllMusicAsUncompleted')
              );
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.MarkingAllMusicAsUncompletedWithErrors')
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
          .deleteAllBooksItems()
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

  public removeAllTrackedMusicData(): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.RemoveAllTrackedMusicData'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState(
          'message',
          this.ngxSignalTranslate.translate('Message.RemovingTrackedMusicData')
        );

        this.api
          .deleteAllMusicItems()
          .pipe(take(1), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.RemovedTrackedMusicData'));
              this.collection.triggerReload();
            },
            error: () => {
              this.blockerLoadingState.patchState('show', false);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.RemovingTrackedMusicDataWithErrors')
              );
            },
          });
      });
  }
}
