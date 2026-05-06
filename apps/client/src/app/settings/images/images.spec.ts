import { TestBed } from '@angular/core/testing';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageRefreshService } from './image-refresh/image-refresh-service';
import { SettingsImages } from './images';

describe('SettingsImages component', () => {
  let component: SettingsImages;
  let imageRefresh: { refreshImages: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    imageRefresh = { refreshImages: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SettingsImages],
      providers: [
        provideStore(initialApiState, apiStateToken),
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    TestBed.overrideComponent(SettingsImages, {
      set: {
        providers: [{ provide: ImageRefreshService, useValue: imageRefresh }],
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
});
