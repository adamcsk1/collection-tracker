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
import { EMPTY, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionService } from '../../../collection/collection-service';
import { ImageRefreshService } from './image-refresh-service';

describe('ImageRefreshService', () => {
  let service: ImageRefreshService;
  let api: { refreshImages: ReturnType<typeof vi.fn> };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };
  let collection: { triggerReload: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { refreshImages: vi.fn(() => of({ count: 2, checked: 2, fixed: 0, errors: 0 })) };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };
    collection = { triggerReload: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ImageRefreshService,
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        { provide: CollectionService, useValue: collection },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(ImageRefreshService);
  });

  it('does nothing when the user cancels the confirmation', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    service.refreshImages();

    expect(api.refreshImages).not.toHaveBeenCalled();
    expect(service.state().running).toBe(false);
    expect(toastState.state.message()).toBe('');
  });

  it('sets running state and shows blocker when confirmed', () => {
    api.refreshImages = vi.fn(() => new Subject());

    service.refreshImages();

    expect(service.state().running).toBe(true);
    expect(TestBed.inject(blockerLoadingStateToken).state.show()).toBe(true);
  });

  it('cleans up running state and blocker on API error', () => {
    api.refreshImages = vi.fn(() => throwError(() => new Error('network error')));
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    service.refreshImages();

    expect(service.state().running).toBe(false);
    expect(service.state().completed).toBe(false);
    expect(TestBed.inject(blockerLoadingStateToken).state.show()).toBe(false);
    expect(toastState.state.message()).toBe('Toast.ImageRefreshError');
  });

  it('cleans up running state and blocker when request is cancelled on destroy', () => {
    const response = new Subject<{ count: number; checked: number; fixed: number; errors: number }>();
    api.refreshImages = vi.fn(() => response);
    const blockerState = TestBed.inject(blockerLoadingStateToken);
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    service.refreshImages();

    TestBed.resetTestingModule();

    expect(response.observed).toBe(false);
    expect(service.state().running).toBe(false);
    expect(blockerState.state.show()).toBe(false);
    expect(toastState.state.message()).toBe('');
  });

  it('shows success toast when all images are valid', () => {
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    service.refreshImages();

    expect(toastState.state.message()).toBe('Toast.ImagesRegenerated');
    expect(service.state().running).toBe(false);
    expect(service.state().completed).toBe(true);
    expect(service.state().count).toBe(2);
    expect(service.state().checked).toBe(2);
    expect(service.state().fixed).toBe(0);
    expect(service.state().errors).toBe(0);
    expect(collection.triggerReload).toHaveBeenCalled();
  });

  it('passes selected shared library to the API', () => {
    service.refreshImages('owner-code');

    expect(api.refreshImages).toHaveBeenCalledWith('owner-code');
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
