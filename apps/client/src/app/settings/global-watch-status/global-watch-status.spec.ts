import { TestBed } from '@angular/core/testing';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { GlobalWatchStatusService } from './global-watch-status-service';
import { SettingsGlobalWatchStatus } from './global-watch-status';

describe('SettingsGlobalWatchStatus component', () => {
  let component: SettingsGlobalWatchStatus;
  let globalWatchStatus: {
    markAllAsWatched: ReturnType<typeof vi.fn>;
    markAllAsUnwatched: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    globalWatchStatus = {
      markAllAsWatched: vi.fn(),
      markAllAsUnwatched: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [SettingsGlobalWatchStatus],
      providers: [
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
      ],
    });

    TestBed.overrideComponent(SettingsGlobalWatchStatus, {
      set: {
        providers: [{ provide: GlobalWatchStatusService, useValue: globalWatchStatus }],
      },
    });

    const fixture = TestBed.createComponent(SettingsGlobalWatchStatus);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calls service to mark all items as watched', () => {
    component.onMarkAllAsWatched();

    expect(globalWatchStatus.markAllAsWatched).toHaveBeenCalled();
    expect(globalWatchStatus.markAllAsUnwatched).not.toHaveBeenCalled();
  });

  it('calls service to mark all items as unwatched', () => {
    component.onMarkAllAsUnwatched();

    expect(globalWatchStatus.markAllAsUnwatched).toHaveBeenCalled();
  });
});
