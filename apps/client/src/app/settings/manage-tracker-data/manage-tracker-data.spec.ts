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
    markAllMoviesAsCompleted: ReturnType<typeof vi.fn>;
    markAllMoviesAsUncompleted: ReturnType<typeof vi.fn>;
    markAllSeriesAsCompleted: ReturnType<typeof vi.fn>;
    markAllSeriesAsUncompleted: ReturnType<typeof vi.fn>;
    markAllBooksAsCompleted: ReturnType<typeof vi.fn>;
    markAllBooksAsUncompleted: ReturnType<typeof vi.fn>;
    removeAllTrackedMovieData: ReturnType<typeof vi.fn>;
    removeAllTrackedSeriesData: ReturnType<typeof vi.fn>;
    removeAllTrackedBookData: ReturnType<typeof vi.fn>;
  };
  let sharesService: { loadShares: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    manageTrackerData = {
      markAllMoviesAsCompleted: vi.fn(),
      markAllMoviesAsUncompleted: vi.fn(),
      markAllSeriesAsCompleted: vi.fn(),
      markAllSeriesAsUncompleted: vi.fn(),
      markAllBooksAsCompleted: vi.fn(),
      markAllBooksAsUncompleted: vi.fn(),
      removeAllTrackedMovieData: vi.fn(),
      removeAllTrackedSeriesData: vi.fn(),
      removeAllTrackedBookData: vi.fn(),
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

  it('calls service to mark all movies as completed', () => {
    component['onMarkAllMoviesAsCompleted']();

    expect(manageTrackerData.markAllMoviesAsCompleted).toHaveBeenCalled();
    expect(manageTrackerData.markAllMoviesAsUncompleted).not.toHaveBeenCalled();
  });

  it('derives tracker actions for the local library', () => {
    expect(component['translations'].messageManageTrackerData()).toBe('Message.ManageTrackerData');
    expect(component['translations'].messageTrackerCleanup()).toBe('Message.TrackerCleanup');
    expect(component['libraryOptions']()).toEqual([{ text: 'MyLibrary', value: '' }]);
    expect(component['showLibrarySelect']()).toBe(false);
    expect(component['canMarkMovies']()).toBe(true);
    expect(component['canMarkSeries']()).toBe(true);
    expect(component['canMarkBooks']()).toBe(true);
  });

  it('renders tracker guidance as article callouts', () => {
    const pageCallout = fixture.nativeElement.querySelector('[data-test-id="manage-tracker-data-info"]');
    const cleanupCallout = fixture.nativeElement.querySelector('[data-test-id="tracker-cleanup-info"]');

    expect(pageCallout.querySelector('.material-icons').textContent.trim()).toBe('article');
    expect(pageCallout.textContent).toContain('Message.ManageTrackerData');
    expect(cleanupCallout.querySelector('aside').getAttribute('role')).toBe('note');
    expect(cleanupCallout.textContent).toContain('Message.TrackerCleanup');
  });

  it('calls service to mark all movies as uncompleted', () => {
    component['onMarkAllMoviesAsUncompleted']();

    expect(manageTrackerData.markAllMoviesAsUncompleted).toHaveBeenCalled();
  });

  it('calls service to mark all series as completed', () => {
    component['onMarkAllSeriesAsCompleted']();

    expect(manageTrackerData.markAllSeriesAsCompleted).toHaveBeenCalled();
  });

  it('calls service to mark all series as uncompleted', () => {
    component['onMarkAllSeriesAsUncompleted']();

    expect(manageTrackerData.markAllSeriesAsUncompleted).toHaveBeenCalled();
  });

  it('calls service to mark all books as completed', () => {
    component['onMarkAllBooksAsCompleted']();

    expect(manageTrackerData.markAllBooksAsCompleted).toHaveBeenCalled();
  });

  it('calls service to mark all books as uncompleted', () => {
    component['onMarkAllBooksAsUncompleted']();

    expect(manageTrackerData.markAllBooksAsUncompleted).toHaveBeenCalled();
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

  it('calls service to remove all tracked book data for My library', () => {
    component['onRemoveAllTrackedBookData']();

    expect(manageTrackerData.removeAllTrackedBookData).toHaveBeenCalledTimes(1);
  });

  it('does not remove tracked data when a shared library is selected', () => {
    component['onLibraryChange']('owner-code');

    component['onRemoveAllTrackedMovieData']();
    component['onRemoveAllTrackedSeriesData']();
    component['onRemoveAllTrackedBookData']();

    expect(manageTrackerData.removeAllTrackedMovieData).not.toHaveBeenCalled();
    expect(manageTrackerData.removeAllTrackedSeriesData).not.toHaveBeenCalled();
    expect(manageTrackerData.removeAllTrackedBookData).not.toHaveBeenCalled();
  });

  it('passes selected shared library to supported completion actions', () => {
    TestBed.inject(sharesStateToken).setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        grants: [
          {
            listType: 'library',
            contentType: 'movie',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
          {
            listType: 'library',
            contentType: 'series',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
          {
            listType: 'books',
            contentType: 'book',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
        ],
      },
    ]);
    component['onLibraryChange']('owner-code');

    component['onMarkAllMoviesAsCompleted']();
    component['onMarkAllMoviesAsUncompleted']();
    component['onMarkAllSeriesAsCompleted']();
    component['onMarkAllSeriesAsUncompleted']();
    component['onMarkAllBooksAsCompleted']();
    component['onMarkAllBooksAsUncompleted']();

    expect(manageTrackerData.markAllMoviesAsCompleted).toHaveBeenCalledWith('owner-code');
    expect(manageTrackerData.markAllMoviesAsUncompleted).toHaveBeenCalledWith('owner-code');
    expect(manageTrackerData.markAllSeriesAsCompleted).toHaveBeenCalledWith('owner-code');
    expect(manageTrackerData.markAllSeriesAsUncompleted).toHaveBeenCalledWith('owner-code');
    expect(manageTrackerData.markAllBooksAsCompleted).toHaveBeenCalledWith('owner-code');
    expect(manageTrackerData.markAllBooksAsUncompleted).toHaveBeenCalledWith('owner-code');
  });

  it('shows the library selector for readable shared libraries', () => {
    const sharesState = TestBed.inject(sharesStateToken);
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        grants: [
          {
            listType: 'library',
            contentType: 'movie',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
          {
            listType: 'library',
            contentType: 'series',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
        ],
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
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-remove-all-tracked-book-data"]').disabled).toBe(
      true
    );
  });

  it('hides the library selector when incoming shares are not readable', () => {
    const sharesState = TestBed.inject(sharesStateToken);
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        grants: [
          {
            listType: 'library',
            contentType: 'movie',
            canRead: false,
            canCreate: true,
            canUpdate: true,
            canDelete: true,
            readMode: 'all',
          },
          {
            listType: 'library',
            contentType: 'series',
            canRead: false,
            canCreate: true,
            canUpdate: true,
            canDelete: true,
            readMode: 'all',
          },
        ],
      },
    ]);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="settings-manage-tracker-data-library"]')).toBeNull();
  });

  it('enables only completion actions backed by the exact readable grant', () => {
    TestBed.inject(sharesStateToken).setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        grants: [
          {
            listType: 'books',
            contentType: 'book',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
        ],
      },
    ]);
    component['onLibraryChange']('owner-code');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="settings-mark-all-books-completed"]').disabled).toBe(
      false
    );
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-mark-all-books-uncompleted"]').disabled).toBe(
      false
    );
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-mark-all-completed"]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-mark-all-series-completed"]').disabled).toBe(
      true
    );
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-remove-all-tracked-book-data"]').disabled).toBe(
      true
    );
  });

  it('hides movie and series actions when both tracker features are disabled', () => {
    TestBed.inject(mainStateToken).setState('collectionFeaturePreferences', {
      ...initialMainState.collectionFeaturePreferences,
      tracking: false,
      books: false,
      music: false,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="settings-mark-all-completed"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-mark-all-series-completed"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-mark-all-books-completed"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-remove-all-tracked-movie-data"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-remove-all-tracked-series-data"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="settings-remove-all-tracked-book-data"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="tracker-cleanup-info"]')).toBeNull();
  });
});
