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
import { EMPTY, NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionService } from '../../../collection/collection-service';
import { ExternalRatingsRefreshService } from './external-ratings-refresh-service';

describe('ExternalRatingsRefreshService', () => {
  let service: ExternalRatingsRefreshService;
  let api: { refreshExternalRatings: ReturnType<typeof vi.fn> };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };
  let collection: { triggerReload: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { refreshExternalRatings: vi.fn(() => of({ count: 2, checked: 2, fixed: 1, errors: 0 })) };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };
    collection = { triggerReload: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ExternalRatingsRefreshService,
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        { provide: CollectionService, useValue: collection },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(ExternalRatingsRefreshService);
  });

  it('does nothing when the user cancels the confirmation', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);

    service.refreshExternalRatings();

    expect(api.refreshExternalRatings).not.toHaveBeenCalled();
    expect(service.state().running).toBe(false);
  });

  it('sets running state and shows blocker when confirmed', () => {
    api.refreshExternalRatings = vi.fn(() => NEVER);

    service.refreshExternalRatings();

    expect(service.state().running).toBe(true);
    expect(TestBed.inject(blockerLoadingStateToken).state.show()).toBe(true);
  });

  it('shows success toast when ratings are refreshed', () => {
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    service.refreshExternalRatings();

    expect(toastState.state.message()).toBe('Toast.ExternalRatingsRefreshed');
    expect(service.state().running).toBe(false);
    expect(service.state().completed).toBe(true);
    expect(service.state().count).toBe(2);
    expect(service.state().checked).toBe(2);
    expect(service.state().fixed).toBe(1);
    expect(service.state().errors).toBe(0);
    expect(collection.triggerReload).toHaveBeenCalled();
  });

  it('passes selected shared library to the API', () => {
    service.refreshExternalRatings('owner-code');

    expect(api.refreshExternalRatings).toHaveBeenCalledWith('owner-code');
  });

  it('hides blocker after processing completes', () => {
    service.refreshExternalRatings();

    expect(TestBed.inject(blockerLoadingStateToken).state.show()).toBe(false);
  });

  it('shows error toast with longer timeout when errors occur', () => {
    api.refreshExternalRatings = vi.fn(() => of({ count: 2, checked: 2, fixed: 1, errors: 1 }));
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    service.refreshExternalRatings();

    expect(toastState.state.message()).toBe('Toast.ExternalRatingsRefreshedWithErrors');
    expect(toastState.state.timeout()).toBe(10000);
    expect(service.state().errors).toBe(1);
  });

  it('hides blocker and resets running state when API fails', () => {
    api.refreshExternalRatings = vi.fn(() => throwError(() => new Error('failed')));

    service.refreshExternalRatings();

    expect(service.state().running).toBe(false);
    expect(TestBed.inject(blockerLoadingStateToken).state.show()).toBe(false);
  });
});
