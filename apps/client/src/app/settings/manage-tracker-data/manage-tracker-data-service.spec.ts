import { TestBed } from '@angular/core/testing';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken, type ToastState } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { EMPTY, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionService } from '../../collection/collection-service';
import { ManageTrackerDataService } from './manage-tracker-data-service';

describe('ManageTrackerDataService', () => {
  let service: ManageTrackerDataService;
  let collectionService: { triggerReload: ReturnType<typeof vi.fn> };
  let api: {
    markAllMoviesAsCompleted: ReturnType<typeof vi.fn>;
    markAllMoviesAsUncompleted: ReturnType<typeof vi.fn>;
    markAllSeriesAsCompleted: ReturnType<typeof vi.fn>;
    markAllSeriesAsUncompleted: ReturnType<typeof vi.fn>;
    markAllBooksAsCompleted: ReturnType<typeof vi.fn>;
    markAllBooksAsUncompleted: ReturnType<typeof vi.fn>;
    markAllMusicAsCompleted: ReturnType<typeof vi.fn>;
    markAllMusicAsUncompleted: ReturnType<typeof vi.fn>;
    deleteAllCompletedMovies: ReturnType<typeof vi.fn>;
    deleteAllTrackingItems: ReturnType<typeof vi.fn>;
    deleteAllBooksItems: ReturnType<typeof vi.fn>;
    deleteAllMusicItems: ReturnType<typeof vi.fn>;
  };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    collectionService = { triggerReload: vi.fn() };
    api = {
      markAllMoviesAsCompleted: vi.fn(() => of({ changedCount: 2 })),
      markAllMoviesAsUncompleted: vi.fn(() => of({ changedCount: 1 })),
      markAllSeriesAsCompleted: vi.fn(() => of({ trackedCount: 1, progressChangedCount: 3 })),
      markAllSeriesAsUncompleted: vi.fn(() => of({ changedCount: 2 })),
      markAllBooksAsCompleted: vi.fn(() => of({ changedCount: 2 })),
      markAllBooksAsUncompleted: vi.fn(() => of({ changedCount: 1 })),
      markAllMusicAsCompleted: vi.fn(() => of({ changedCount: 2 })),
      markAllMusicAsUncompleted: vi.fn(() => of({ changedCount: 1 })),
      deleteAllCompletedMovies: vi.fn(() => of({ changedCount: 2 })),
      deleteAllTrackingItems: vi.fn(() => of({ changedCount: 3 })),
      deleteAllBooksItems: vi.fn(() => of({ changedCount: 4 })),
      deleteAllMusicItems: vi.fn(() => of({ changedCount: 4 })),
    };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      providers: [
        ManageTrackerDataService,
        { provide: CollectionService, useValue: collectionService },
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(ManageTrackerDataService);
  });

  it('marks all movies as completed and completes successfully', () => {
    service.markAllMoviesAsCompleted();

    expect(api.markAllMoviesAsCompleted).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllMoviesAsCompleted');
  });

  it('marks all movies as uncompleted and completes successfully', () => {
    const blocker = TestBed.inject(blockerLoadingStateToken);

    service.markAllMoviesAsUncompleted();

    expect(api.markAllMoviesAsUncompleted).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllMoviesAsUncompleted');
    expect(blocker.state.show()).toBe(false);
  });

  it('marks all series as completed and completes successfully', () => {
    service.markAllSeriesAsCompleted();

    expect(api.markAllSeriesAsCompleted).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllSeriesAsCompleted');
  });

  it('marks all series as uncompleted and completes successfully', () => {
    service.markAllSeriesAsUncompleted();

    expect(api.markAllSeriesAsUncompleted).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllSeriesAsUncompleted');
  });

  it('marks all books as completed and completes successfully', () => {
    service.markAllBooksAsCompleted();

    expect(api.markAllBooksAsCompleted).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllBooksAsCompleted');
  });

  it('marks all books as uncompleted and completes successfully', () => {
    service.markAllBooksAsUncompleted();

    expect(api.markAllBooksAsUncompleted).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllBooksAsUncompleted');
  });

  it('marks all music as completed and completes successfully', () => {
    service.markAllMusicAsCompleted();

    expect(api.markAllMusicAsCompleted).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllMusicAsCompleted');
  });

  it('marks all music as uncompleted and completes successfully', () => {
    service.markAllMusicAsUncompleted();

    expect(api.markAllMusicAsUncompleted).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllMusicAsUncompleted');
  });

  it('does nothing when user declines marking all movies as completed', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    service.markAllMoviesAsCompleted();

    expect(api.markAllMoviesAsCompleted).not.toHaveBeenCalled();
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('does nothing when user declines marking all books as completed', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    service.markAllBooksAsCompleted();

    expect(api.markAllBooksAsCompleted).not.toHaveBeenCalled();
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('does nothing when user declines marking all books as uncompleted', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    service.markAllBooksAsUncompleted();

    expect(api.markAllBooksAsUncompleted).not.toHaveBeenCalled();
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('does nothing when user declines marking all music as completed', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    service.markAllMusicAsCompleted();

    expect(api.markAllMusicAsCompleted).not.toHaveBeenCalled();
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('shows error toast when mark all movies as completed fails', () => {
    api.markAllMoviesAsCompleted = vi.fn(() => throwError(() => new Error('fail')));
    service.markAllMoviesAsCompleted();

    expect(api.markAllMoviesAsCompleted).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkingAllMoviesAsCompletedWithErrors');
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('shows error toast when mark all books as completed fails', () => {
    api.markAllBooksAsCompleted = vi.fn(() => throwError(() => new Error('fail')));
    service.markAllBooksAsCompleted();

    expect(api.markAllBooksAsCompleted).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkingAllBooksAsCompletedWithErrors');
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('shows error toast when mark all books as uncompleted fails', () => {
    api.markAllBooksAsUncompleted = vi.fn(() => throwError(() => new Error('fail')));
    service.markAllBooksAsUncompleted();

    expect(api.markAllBooksAsUncompleted).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkingAllBooksAsUncompletedWithErrors');
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('shows error toast when mark all music as completed fails', () => {
    api.markAllMusicAsCompleted = vi.fn(() => throwError(() => new Error('fail')));
    service.markAllMusicAsCompleted();

    expect(api.markAllMusicAsCompleted).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkingAllMusicAsCompletedWithErrors');
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('passes selected shared library to mark all movies completed', () => {
    service.markAllMoviesAsCompleted('owner-code');

    expect(api.markAllMoviesAsCompleted).toHaveBeenCalledWith('owner-code');
  });

  it('passes selected shared library to mark all movies uncompleted', () => {
    service.markAllMoviesAsUncompleted('owner-code');

    expect(api.markAllMoviesAsUncompleted).toHaveBeenCalledWith('owner-code');
  });

  it('passes selected shared library to mark all series completed', () => {
    service.markAllSeriesAsCompleted('owner-code');

    expect(api.markAllSeriesAsCompleted).toHaveBeenCalledWith('owner-code');
  });

  it('passes selected shared library to mark all series uncompleted', () => {
    service.markAllSeriesAsUncompleted('owner-code');

    expect(api.markAllSeriesAsUncompleted).toHaveBeenCalledWith('owner-code');
  });

  it('passes selected shared library to mark all books completed', () => {
    service.markAllBooksAsCompleted('owner-code');

    expect(api.markAllBooksAsCompleted).toHaveBeenCalledWith('owner-code');
  });

  it('passes selected shared library to mark all books uncompleted', () => {
    service.markAllBooksAsUncompleted('owner-code');

    expect(api.markAllBooksAsUncompleted).toHaveBeenCalledWith('owner-code');
  });

  it('passes selected shared library to mark all music completed', () => {
    service.markAllMusicAsCompleted('owner-code');

    expect(api.markAllMusicAsCompleted).toHaveBeenCalledWith('owner-code');
  });

  it('passes selected shared library to mark all music uncompleted', () => {
    service.markAllMusicAsUncompleted('owner-code');

    expect(api.markAllMusicAsUncompleted).toHaveBeenCalledWith('owner-code');
  });

  it('removes all tracked movie data and completes successfully', () => {
    service.removeAllTrackedMovieData();

    expect(confirm.ifConfirmed).toHaveBeenCalledWith('Confirm.RemoveAllTrackedMovieData');
    expect(api.deleteAllCompletedMovies).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.RemovedTrackedMovieData');
  });

  it('removes all tracked series data and completes successfully', () => {
    service.removeAllTrackedSeriesData();

    expect(confirm.ifConfirmed).toHaveBeenCalledWith('Confirm.RemoveAllTrackedSeriesData');
    expect(api.deleteAllTrackingItems).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.RemovedTrackedSeriesData');
  });

  it('removes all tracked book data and completes successfully', () => {
    service.removeAllTrackedBookData();

    expect(confirm.ifConfirmed).toHaveBeenCalledWith('Confirm.RemoveAllTrackedBookData');
    expect(api.deleteAllBooksItems).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.RemovedTrackedBookData');
  });

  it('removes all tracked music data and completes successfully', () => {
    service.removeAllTrackedMusicData();

    expect(confirm.ifConfirmed).toHaveBeenCalledWith('Confirm.RemoveAllTrackedMusicData');
    expect(api.deleteAllMusicItems).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.RemovedTrackedMusicData');
  });

  it('shows error toast when removing tracked movie data fails', () => {
    api.deleteAllCompletedMovies = vi.fn(() => throwError(() => new Error('fail')));
    service.removeAllTrackedMovieData();

    expect(api.deleteAllCompletedMovies).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.RemovingTrackedMovieDataWithErrors');
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('shows error toast when removing tracked series data fails', () => {
    api.deleteAllTrackingItems = vi.fn(() => throwError(() => new Error('fail')));
    service.removeAllTrackedSeriesData();

    expect(api.deleteAllTrackingItems).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.RemovingTrackedSeriesDataWithErrors');
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });
});
