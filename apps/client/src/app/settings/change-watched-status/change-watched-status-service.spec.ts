import { TestBed } from '@angular/core/testing';
import { CollectionService } from '../../collection/collection-service';
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
import { ChangeWatchedStatusService } from './change-watched-status-service';

describe('ChangeWatchedStatusService', () => {
  let service: ChangeWatchedStatusService;
  let collectionService: { loadCollection: ReturnType<typeof vi.fn> };
  let api: { markAllAsWatched: ReturnType<typeof vi.fn>; markAllAsUnwatched: ReturnType<typeof vi.fn> };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    collectionService = { loadCollection: vi.fn(() => of(undefined)) };
    api = {
      markAllAsWatched: vi.fn(() => of({ changedCount: 2 })),
      markAllAsUnwatched: vi.fn(() => of({ changedCount: 1 })),
    };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      providers: [
        ChangeWatchedStatusService,
        { provide: CollectionService, useValue: collectionService },
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(ChangeWatchedStatusService);
  });

  it('marks all items as watched and completes successfully', () => {
    service.markAllAsWatched();

    expect(api.markAllAsWatched).toHaveBeenCalledTimes(1);
    expect(collectionService.loadCollection).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllAsWatched');
  });

  it('marks all items as unwatched and completes successfully', () => {
    const blocker = TestBed.inject(blockerLoadingStateToken);

    service.markAllAsUnwatched();

    expect(api.markAllAsUnwatched).toHaveBeenCalledTimes(1);
    expect(collectionService.loadCollection).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllAsUnwatched');
    expect(blocker.state.show()).toBe(false);
  });

  it('does nothing when user declines marking all as watched', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    service.markAllAsWatched();

    expect(api.markAllAsWatched).not.toHaveBeenCalled();
    expect(collectionService.loadCollection).not.toHaveBeenCalled();
  });

  it('shows error toast when mark all as watched fails', () => {
    api.markAllAsWatched = vi.fn(() => throwError(() => new Error('fail')));
    service.markAllAsWatched();

    expect(api.markAllAsWatched).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    expect(toast.state.message()).toBe('Toast.MarkingAllAsWatchedWithErrors');
    expect(collectionService.loadCollection).toHaveBeenCalledTimes(1);
  });
});
