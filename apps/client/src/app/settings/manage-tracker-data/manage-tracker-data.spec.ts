import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { SharesService } from '../../shares/shares-service';
import { initialSharesState, sharesStateToken } from '../../shares/shares-store';
import { ManageTrackerDataService } from './manage-tracker-data-service';
import { SettingsManageTrackerData } from './manage-tracker-data';

describe('SettingsManageTrackerData component', () => {
  let component: SettingsManageTrackerData;
  let fixture: ComponentFixture<SettingsManageTrackerData>;
  let manageTrackerData: {
    markAllMoviesAsWatched: ReturnType<typeof vi.fn>;
    markAllMoviesAsUnwatched: ReturnType<typeof vi.fn>;
    markAllSeriesAsWatched: ReturnType<typeof vi.fn>;
    markAllSeriesAsUnwatched: ReturnType<typeof vi.fn>;
    removeAllTrackedMovieData: ReturnType<typeof vi.fn>;
    removeAllTrackedSeriesData: ReturnType<typeof vi.fn>;
  };
  let sharesService: { loadShares: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    manageTrackerData = {
      markAllMoviesAsWatched: vi.fn(),
      markAllMoviesAsUnwatched: vi.fn(),
      markAllSeriesAsWatched: vi.fn(),
      markAllSeriesAsUnwatched: vi.fn(),
      removeAllTrackedMovieData: vi.fn(),
      removeAllTrackedSeriesData: vi.fn(),
    };
    sharesService = { loadShares: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SettingsManageTrackerData],
      providers: [
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialSharesState, sharesStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
      ],
    });

    TestBed.overrideComponent(SettingsManageTrackerData, {
      set: {
        providers: [
          { provide: ManageTrackerDataService, useValue: manageTrackerData },
          { provide: SharesService, useValue: sharesService },
        ],
      },
    });

    fixture = TestBed.createComponent(SettingsManageTrackerData);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calls service to mark all movies as watched', () => {
    component['onMarkAllMoviesAsWatched']();

    expect(manageTrackerData.markAllMoviesAsWatched).toHaveBeenCalled();
    expect(manageTrackerData.markAllMoviesAsUnwatched).not.toHaveBeenCalled();
  });

  it('calls service to mark all movies as unwatched', () => {
    component['onMarkAllMoviesAsUnwatched']();

    expect(manageTrackerData.markAllMoviesAsUnwatched).toHaveBeenCalled();
  });

  it('calls service to mark all series as watched', () => {
    component['onMarkAllSeriesAsWatched']();

    expect(manageTrackerData.markAllSeriesAsWatched).toHaveBeenCalled();
  });

  it('calls service to mark all series as unwatched', () => {
    component['onMarkAllSeriesAsUnwatched']();

    expect(manageTrackerData.markAllSeriesAsUnwatched).toHaveBeenCalled();
  });

  it('loads shares when created', () => {
    expect(sharesService.loadShares).toHaveBeenCalled();
  });

  it('calls service to remove all tracked movie data for My library', () => {
    component['onRemoveAllTrackedMovieData']();

    expect(manageTrackerData.removeAllTrackedMovieData).toHaveBeenCalledTimes(1);
  });

  it('calls service to remove all tracked series data for My library', () => {
    component['onRemoveAllTrackedSeriesData']();

    expect(manageTrackerData.removeAllTrackedSeriesData).toHaveBeenCalledTimes(1);
  });

  it('does not remove tracked data when a shared library is selected', () => {
    component['onLibraryChange']('owner-code');

    component['onRemoveAllTrackedMovieData']();
    component['onRemoveAllTrackedSeriesData']();

    expect(manageTrackerData.removeAllTrackedMovieData).not.toHaveBeenCalled();
    expect(manageTrackerData.removeAllTrackedSeriesData).not.toHaveBeenCalled();
  });

  it('passes selected shared library to all watch status actions', () => {
    component['onLibraryChange']('owner-code');

    component['onMarkAllMoviesAsWatched']();
    component['onMarkAllMoviesAsUnwatched']();
    component['onMarkAllSeriesAsWatched']();
    component['onMarkAllSeriesAsUnwatched']();

    expect(manageTrackerData.markAllMoviesAsWatched).toHaveBeenCalledWith('owner-code');
    expect(manageTrackerData.markAllMoviesAsUnwatched).toHaveBeenCalledWith('owner-code');
    expect(manageTrackerData.markAllSeriesAsWatched).toHaveBeenCalledWith('owner-code');
    expect(manageTrackerData.markAllSeriesAsUnwatched).toHaveBeenCalledWith('owner-code');
  });

  it('shows the library selector for readable shared libraries', () => {
    const sharesState = TestBed.inject(sharesStateToken);
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      },
    ]);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="settings-manage-tracker-data-library"]')).not.toBeNull();
  });

  it('disables tracker cleanup buttons when a shared library is selected', () => {
    component['onLibraryChange']('owner-code');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-test-id="settings-remove-all-tracked-movie-data"]').disabled
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-test-id="settings-remove-all-tracked-series-data"]').disabled
    ).toBe(true);
  });

  it('hides the library selector when incoming shares are not readable', () => {
    const sharesState = TestBed.inject(sharesStateToken);
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        canRead: false,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      },
    ]);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="settings-manage-tracker-data-library"]')).toBeNull();
  });

  it('hides movie and series actions when both tracker features are disabled', () => {
    TestBed.inject(mainStateToken).setState('collectionFeaturePreferences', {
      ...initialMainState.collectionFeaturePreferences,
      movieTracker: false,
      seriesTracker: false,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="settings-mark-all-watched"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-mark-all-series-watched"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-remove-all-tracked-movie-data"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-remove-all-tracked-series-data"]')).toBeNull();
  });
});
