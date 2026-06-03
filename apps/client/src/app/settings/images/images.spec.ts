import { TestBed } from '@angular/core/testing';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharesService } from '../../shares/shares-service';
import { initialSharesState, sharesStateToken } from '../../shares/shares-store';
import { ImageRefreshService } from './image-refresh/image-refresh-service';
import { SettingsImages } from './images';

describe('SettingsImages component', () => {
  let component: SettingsImages;
  let imageRefresh: { refreshImages: ReturnType<typeof vi.fn> };
  let sharesService: { loadShares: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    imageRefresh = { refreshImages: vi.fn() };
    sharesService = { loadShares: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SettingsImages],
      providers: [
        provideStore(initialApiState, apiStateToken),
        provideStore(initialSharesState, sharesStateToken),
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
        { provide: ApiService, useValue: {} },
      ],
    });

    TestBed.overrideComponent(SettingsImages, {
      set: {
        providers: [
          { provide: ImageRefreshService, useValue: imageRefresh },
          { provide: SharesService, useValue: sharesService },
        ],
      },
    });

    const fixture = TestBed.createComponent(SettingsImages);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calls service to refresh images', () => {
    component['onStartImagesRefresh']();

    expect(imageRefresh.refreshImages).toHaveBeenCalled();
  });

  it('loads shares when created', () => {
    expect(sharesService.loadShares).toHaveBeenCalled();
  });

  it('passes selected shared library to refresh images', () => {
    component['onLibraryChange']('owner-code');

    component['onStartImagesRefresh']();

    expect(imageRefresh.refreshImages).toHaveBeenCalledWith('owner-code');
  });
});
