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
import { EMPTY, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageRefreshService } from './image-refresh-service';

describe('ImageRefreshService', () => {
  let service: ImageRefreshService;
  let api: { refreshImages: ReturnType<typeof vi.fn> };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { refreshImages: vi.fn(() => of({ count: 2, checked: 2, fixed: 0, errors: 0 })) };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      providers: [
        ImageRefreshService,
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(ImageRefreshService);
  });

  it('does nothing when the user cancels the confirmation', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);

    service.refreshImages();

    expect(api.refreshImages).not.toHaveBeenCalled();
    expect(service.state().running).toBe(false);
  });

  it('sets running state and shows blocker when confirmed', () => {
    api.refreshImages = vi.fn(() => EMPTY);

    service.refreshImages();

    expect(service.state().running).toBe(true);
    expect(TestBed.inject(blockerLoadingStateToken).state.show()).toBe(true);
  });

  it('shows success toast when all images are valid', () => {
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    service.refreshImages();

    expect(toastState.state.message()).toBe('Toast.ImagesRegenerated');
    expect(service.state().running).toBe(false);
    expect(service.state().count).toBe(2);
    expect(service.state().checked).toBe(2);
    expect(service.state().fixed).toBe(0);
    expect(service.state().errors).toBe(0);
  });

  it('hides blocker after processing completes', () => {
    service.refreshImages();

    expect(TestBed.inject(blockerLoadingStateToken).state.show()).toBe(false);
  });

  it('shows error toast with longer timeout when errors occur', () => {
    api.refreshImages = vi.fn(() => of({ count: 2, checked: 2, fixed: 0, errors: 1 }));
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    service.refreshImages();

    expect(toastState.state.message()).toBe('Toast.ImagesRegeneratedWithErrors');
    expect(toastState.state.timeout()).toBe(10000);
    expect(service.state().errors).toBe(1);
  });
});
