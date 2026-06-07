import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharesService } from '../../shares/shares-service';
import { initialSharesState, sharesStateToken } from '../../shares/shares-store';
import { ExternalRatingsRefreshService } from './external-ratings-refresh/external-ratings-refresh-service';
import { ImageRefreshService } from './image-refresh/image-refresh-service';
import { SettingsMediaRefresh } from './media-refresh';

describe('SettingsMediaRefresh component', () => {
  let component: SettingsMediaRefresh;
  let fixture: ComponentFixture<SettingsMediaRefresh>;
  let externalRatingsRefresh: { refreshExternalRatings: ReturnType<typeof vi.fn>; state: ReturnType<typeof signal> };
  let externalRatingsRefreshState: WritableSignal<RefreshStatusTestModel>;
  let imageRefresh: { refreshImages: ReturnType<typeof vi.fn>; state: ReturnType<typeof signal> };
  let imageRefreshState: WritableSignal<RefreshStatusTestModel>;
  let sharesService: { loadShares: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    externalRatingsRefreshState = signal(buildRefreshState());
    imageRefreshState = signal(buildRefreshState());
    externalRatingsRefresh = { refreshExternalRatings: vi.fn(), state: externalRatingsRefreshState };
    imageRefresh = { refreshImages: vi.fn(), state: imageRefreshState };
    sharesService = { loadShares: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SettingsMediaRefresh],
      providers: [
        provideStore(initialApiState, apiStateToken),
        provideStore(initialSharesState, sharesStateToken),
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
        { provide: ApiService, useValue: {} },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
      ],
    });

    TestBed.overrideComponent(SettingsMediaRefresh, {
      set: {
        providers: [
          { provide: ExternalRatingsRefreshService, useValue: externalRatingsRefresh },
          { provide: ImageRefreshService, useValue: imageRefresh },
          { provide: SharesService, useValue: sharesService },
        ],
      },
    });

    fixture = TestBed.createComponent(SettingsMediaRefresh);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calls service to refresh images', () => {
    component['onStartImagesRefresh']();

    expect(imageRefresh.refreshImages).toHaveBeenCalled();
  });

  it('calls service to refresh external ratings', () => {
    component['onStartExternalRatingsRefresh']();

    expect(externalRatingsRefresh.refreshExternalRatings).toHaveBeenCalled();
  });

  it('loads shares when created', () => {
    expect(sharesService.loadShares).toHaveBeenCalled();
  });

  it('passes selected shared library to refresh images', () => {
    component['onLibraryChange']('owner-code');

    component['onStartImagesRefresh']();

    expect(imageRefresh.refreshImages).toHaveBeenCalledWith('owner-code');
  });

  it('passes selected shared library to refresh external ratings', () => {
    component['onLibraryChange']('owner-code');

    component['onStartExternalRatingsRefresh']();

    expect(externalRatingsRefresh.refreshExternalRatings).toHaveBeenCalledWith('owner-code');
  });

  it('hides refresh statuses before a refresh completes', () => {
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-image-refresh-status"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-external-ratings-refresh-status"]')).toBeNull();
  });

  it('shows image refresh status after completion', () => {
    imageRefreshState.set(buildRefreshState({ completed: true, count: 4, checked: 3, fixed: 2, errors: 1 }));

    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[data-test-id="settings-image-refresh-status"]');
    expect(status.textContent).toContain('ImageRefresh');
    expect(status.textContent).toContain('Count');
    expect(status.textContent).toContain('4');
    expect(status.textContent).toContain('Checked');
    expect(status.textContent).toContain('3');
    expect(status.textContent).toContain('Fixed');
    expect(status.textContent).toContain('2');
    expect(status.textContent).toContain('Errors');
    expect(status.textContent).toContain('1');
  });

  it('shows external ratings refresh status after completion', () => {
    externalRatingsRefreshState.set(buildRefreshState({ completed: true, count: 5, checked: 4, fixed: 3, errors: 2 }));

    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[data-test-id="settings-external-ratings-refresh-status"]');
    expect(status.textContent).toContain('ExternalRatingsRefresh');
    expect(status.textContent).toContain('Count');
    expect(status.textContent).toContain('5');
    expect(status.textContent).toContain('Checked');
    expect(status.textContent).toContain('4');
    expect(status.textContent).toContain('Updated');
    expect(status.textContent).toContain('3');
    expect(status.textContent).toContain('Errors');
    expect(status.textContent).toContain('2');
  });
});

interface RefreshStatusTestModel {
  running: boolean;
  completed: boolean;
  count: number;
  checked: number;
  fixed: number;
  errors: number;
}

const buildRefreshState = (overrides: Partial<RefreshStatusTestModel> = {}): RefreshStatusTestModel => ({
  running: false,
  completed: false,
  count: 0,
  checked: 0,
  fixed: 0,
  errors: 0,
  ...overrides,
});
