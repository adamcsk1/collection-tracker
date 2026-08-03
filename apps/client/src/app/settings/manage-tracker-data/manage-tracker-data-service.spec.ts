import { TestBed } from '@angular/core/testing';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
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
    markAllMoviesAsWatched: ReturnType<typeof vi.fn>;
    markAllMoviesAsUnwatched: ReturnType<typeof vi.fn>;
    markAllSeriesAsWatched: ReturnType<typeof vi.fn>;
    markAllSeriesAsUnwatched: ReturnType<typeof vi.fn>;
    deleteAllMovieTrackerItems: ReturnType<typeof vi.fn>;
    deleteAllSeriesTrackerItems: ReturnType<typeof vi.fn>;
    deleteAllBookTrackerItems: ReturnType<typeof vi.fn>;
  };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    collectionService = { triggerReload: vi.fn() };
    api = {
      markAllMoviesAsWatched: vi.fn(() => of({ changedCount: 2 })),
      markAllMoviesAsUnwatched: vi.fn(() => of({ changedCount: 1 })),
      markAllSeriesAsWatched: vi.fn(() => of({ trackedCount: 1, progressChangedCount: 3 })),
      markAllSeriesAsUnwatched: vi.fn(() => of({ changedCount: 2 })),
      deleteAllMovieTrackerItems: vi.fn(() => of({ changedCount: 2 })),
      deleteAllSeriesTrackerItems: vi.fn(() => of({ changedCount: 3 })),
      deleteAllBookTrackerItems: vi.fn(() => of({ changedCount: 4 })),
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

  it('marks all movies as watched and completes successfully', () => {
    service.markAllMoviesAsWatched();

    expect(api.markAllMoviesAsWatched).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllMoviesAsWatched');
  });

  it('marks all movies as unwatched and completes successfully', () => {
    const blocker = TestBed.inject(blockerLoadingStateToken);

    service.markAllMoviesAsUnwatched();

    expect(api.markAllMoviesAsUnwatched).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllMoviesAsUnwatched');
    expect(blocker.state.show()).toBe(false);
  });

  it('marks all series as watched and completes successfully', () => {
    service.markAllSeriesAsWatched();

    expect(api.markAllSeriesAsWatched).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllSeriesAsWatched');
  });

  it('marks all series as unwatched and completes successfully', () => {
    service.markAllSeriesAsUnwatched();

    expect(api.markAllSeriesAsUnwatched).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllSeriesAsUnwatched');
  });

  it('does nothing when user declines marking all movies as watched', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    service.markAllMoviesAsWatched();

    expect(api.markAllMoviesAsWatched).not.toHaveBeenCalled();
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('shows error toast when mark all movies as watched fails', () => {
    api.markAllMoviesAsWatched = vi.fn(() => throwError(() => new Error('fail')));
    service.markAllMoviesAsWatched();

    expect(api.markAllMoviesAsWatched).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkingAllMoviesAsWatchedWithErrors');
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('passes selected shared library to mark all movies watched', () => {
    service.markAllMoviesAsWatched('owner-code');

    expect(api.markAllMoviesAsWatched).toHaveBeenCalledWith('owner-code');
  });

  it('passes selected shared library to mark all movies unwatched', () => {
    service.markAllMoviesAsUnwatched('owner-code');

    expect(api.markAllMoviesAsUnwatched).toHaveBeenCalledWith('owner-code');
  });

  it('passes selected shared library to mark all series watched', () => {
    service.markAllSeriesAsWatched('owner-code');

    expect(api.markAllSeriesAsWatched).toHaveBeenCalledWith('owner-code');
  });

  it('passes selected shared library to mark all series unwatched', () => {
    service.markAllSeriesAsUnwatched('owner-code');

    expect(api.markAllSeriesAsUnwatched).toHaveBeenCalledWith('owner-code');
  });

  it('removes all tracked movie data and completes successfully', () => {
    service.removeAllTrackedMovieData();

    expect(confirm.ifConfirmed).toHaveBeenCalledWith('Confirm.RemoveAllTrackedMovieData');
    expect(api.deleteAllMovieTrackerItems).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.RemovedTrackedMovieData');
  });

  it('removes all tracked series data and completes successfully', () => {
    service.removeAllTrackedSeriesData();

    expect(confirm.ifConfirmed).toHaveBeenCalledWith('Confirm.RemoveAllTrackedSeriesData');
    expect(api.deleteAllSeriesTrackerItems).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.RemovedTrackedSeriesData');
  });

  it('removes all tracked book data and completes successfully', () => {
    service.removeAllTrackedBookData();

    expect(confirm.ifConfirmed).toHaveBeenCalledWith('Confirm.RemoveAllTrackedBookData');
    expect(api.deleteAllBookTrackerItems).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.RemovedTrackedBookData');
  });

  it('shows error toast when removing tracked movie data fails', () => {
    api.deleteAllMovieTrackerItems = vi.fn(() => throwError(() => new Error('fail')));
    service.removeAllTrackedMovieData();

    expect(api.deleteAllMovieTrackerItems).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.RemovingTrackedMovieDataWithErrors');
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('shows error toast when removing tracked series data fails', () => {
    api.deleteAllSeriesTrackerItems = vi.fn(() => throwError(() => new Error('fail')));
    service.removeAllTrackedSeriesData();

    expect(api.deleteAllSeriesTrackerItems).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.RemovingTrackedSeriesDataWithErrors');
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });
});
