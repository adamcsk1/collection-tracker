import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import {
  COMPLETED_TAG,
  FAVORITE_TAG,
  MOVIE_TAG,
  SERIES_TAG,
  VIRTUAL_UNWATCHED_TAG,
  WATCH_LATER_TAG,
  WISHLIST_TAG,
} from '@shared/constants/tags-const';
import { CollectionItemApiModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialMainState, mainStateToken } from '../../../main/main-store';
import { initialSharesState, SharesState, sharesStateToken } from '../../../shares/shares-store';
import { CollectionItemModel } from '../../collection-model';
import { CollectionService } from '../../collection-service';
import { ItemDialog } from './item-dialog';
import { SeriesSeasonMetadataDialog } from '../../series-tracker/series-season-metadata-dialog/series-season-metadata-dialog';
import { isSystemDisplayTag } from './utils/item-dialog-util';

const CUSTOM_WATCHED_TAG = '#watched';

const buildItem = (overrides: Partial<CollectionItemModel> = {}): CollectionItemModel => ({
  image: 'https://example.com/poster.jpg',
  title: 'Test Movie',
  titleLower: 'test movie',
  genre: ['Drama', 'Thriller'],
  IMDbId: 'tt1234567',
  tags: [MOVIE_TAG, '#action'],
  year: '2020',
  rate: '8.5',
  rottenTomatoesRate: '',
  metacriticRate: '',
  userRate: null,
  hash: 'testhash',
  actors: 'Actor One, Actor Two',
  plot: 'A test plot.',
  listType: 'library',
  ...overrides,
});

const buildApiItem = (overrides: Partial<CollectionItemApiModel> = {}): CollectionItemApiModel => ({
  image: 'https://example.com/poster.jpg',
  title: 'Test Movie',
  titleLower: 'test movie',
  genre: ['Drama', 'Thriller'],
  IMDbId: 'tt1234567',
  tags: [MOVIE_TAG, '#action'],
  year: '2020',
  rate: '8.5',
  rottenTomatoesRate: '',
  metacriticRate: '',
  userRate: null,
  hash: 'newhash',
  actors: 'Actor One, Actor Two',
  plot: 'A test plot.',
  listType: 'library',
  ...overrides,
});

describe('ItemDialog', () => {
  let fixture: ComponentFixture<ItemDialog>;
  let component: ItemDialog;
  let collectionService: {
    addCollectionItem: ReturnType<typeof vi.fn>;
    deleteCollectionItem: ReturnType<typeof vi.fn>;
    updateCollectionItem: ReturnType<typeof vi.fn>;
    triggerReload: ReturnType<typeof vi.fn>;
  };
  let portal: {
    closeAll: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    openStacked: ReturnType<typeof vi.fn>;
  };
  let confirm: { open: ReturnType<typeof vi.fn> };
  let api: {
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    getSeriesTrackerSeasons: ReturnType<typeof vi.fn>;
    getSeriesTrackerWatchedEpisodes: ReturnType<typeof vi.fn>;
    updateSeriesTrackerWatchedEpisodes: ReturnType<typeof vi.fn>;
    refreshSeriesTrackerSeasons: ReturnType<typeof vi.fn>;
    deleteSeriesTrackerSeasons: ReturnType<typeof vi.fn>;
    markAllSeriesTrackerWatched: ReturnType<typeof vi.fn>;
    addMovieTrackerItem: ReturnType<typeof vi.fn>;
    addSeriesTrackerItem: ReturnType<typeof vi.fn>;
    deleteMovieTrackerItem: ReturnType<typeof vi.fn>;
    collectionItemExists: ReturnType<typeof vi.fn>;
  };
  let toastState: NgxSimpleSignalStoreService<ToastState>;
  let spinnerLoadingState: NgxSimpleSignalStoreService<{ show: boolean }>;
  let sharesState: NgxSimpleSignalStoreService<SharesState>;
  let translate: { translate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    collectionService = {
      addCollectionItem: vi.fn(),
      deleteCollectionItem: vi.fn(),
      updateCollectionItem: vi.fn(),
      triggerReload: vi.fn(),
    };
    portal = { closeAll: vi.fn(), open: vi.fn(), openStacked: vi.fn() };
    confirm = { open: vi.fn() };
    api = {
      delete: vi.fn(() => of(undefined)),
      update: vi.fn(() => of({ item: buildApiItem() })),
      getSeriesTrackerSeasons: vi.fn(() => of({ seasons: [] })),
      getSeriesTrackerWatchedEpisodes: vi.fn(() => of({ watchedEpisodes: [], lastWatchedEpisode: null })),
      updateSeriesTrackerWatchedEpisodes: vi.fn(() =>
        of({
          watchedEpisodes: [],
          lastWatchedEpisode: null,
          item: buildApiItem({ listType: 'series-tracker', tags: [SERIES_TAG], hash: 'unwatched-hash' }),
        })
      ),
      refreshSeriesTrackerSeasons: vi.fn(() =>
        of({
          seasons: [{ season: 1, episodes: 2 }],
          item: buildApiItem({ listType: 'series-tracker', tags: [SERIES_TAG], hash: 'refreshed-hash' }),
        })
      ),
      deleteSeriesTrackerSeasons: vi.fn(() =>
        of({
          seasons: [],
          item: buildApiItem({ listType: 'series-tracker', tags: [SERIES_TAG], hash: 'metadata-deleted-hash' }),
        })
      ),
      markAllSeriesTrackerWatched: vi.fn(() =>
        of({
          watchedEpisodes: [
            { season: 1, episode: 1 },
            { season: 1, episode: 2 },
          ],
          lastWatchedEpisode: { season: 1, episode: 2 },
          item: buildApiItem({ listType: 'series-tracker', tags: [SERIES_TAG, COMPLETED_TAG], hash: 'completed-hash' }),
        })
      ),
      addMovieTrackerItem: vi.fn(() => of({ item: buildApiItem({ listType: 'movie-tracker', watched: true }) })),
      addSeriesTrackerItem: vi.fn(() => of({ item: buildApiItem({ listType: 'series-tracker', tags: [SERIES_TAG] }) })),
      deleteMovieTrackerItem: vi.fn(() => of(undefined)),
      collectionItemExists: vi.fn(() => of({ exists: false })),
    };
    translate = { translate: vi.fn((key: string) => key) };

    TestBed.configureTestingModule({
      imports: [ItemDialog],
      providers: [
        { provide: CollectionService, useValue: collectionService },
        { provide: PortalService, useValue: portal },
        { provide: ConfirmService, useValue: confirm },
        { provide: ApiService, useValue: api },
        { provide: NgxSignalTranslateService, useValue: translate },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialSharesState, sharesStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialToastState, toastStateToken),
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
      ],
    });
    TestBed.overrideComponent(ItemDialog, {
      set: {
        template: '',
      },
    });

    fixture = TestBed.createComponent(ItemDialog);
    component = fixture.componentInstance;
    toastState = TestBed.inject(toastStateToken);
    spinnerLoadingState = TestBed.inject(spinnerLoadingStateToken);
    sharesState = TestBed.inject(sharesStateToken);

    fixture.componentRef.setInput('collectionItem', buildItem());
    fixture.detectChanges();
  });

  it('initializes draft item from the input model', () => {
    expect(component['form'].title().value()).toBe('Test Movie');
    expect(component['form'].IMDbId().value()).toBe('tt1234567');
    expect(component['form'].tagsText().value()).toBe(`${MOVIE_TAG} #action`);
  });

  it('initializes external rating fields from the input model', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ rottenTomatoesRate: '96%', metacriticRate: '85/100' }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['form'].rottenTomatoesRate().value()).toBe('96%');
    expect(component['form'].metacriticRate().value()).toBe('85/100');
  });

  it('toggles edit mode', () => {
    expect(component['editMode']()).toBe(false);

    component['onEdit']();
    expect(component['editMode']()).toBe(true);

    component['onReadOnly']();
    expect(component['editMode']()).toBe(false);
  });

  it('restores last saved item when switching back to read-only', () => {
    component['onEdit']();
    component['form'].title().value.set('Modified Title');
    expect(component['form'].title().value()).toBe('Modified Title');

    component['onReadOnly']();
    expect(component['form'].title().value()).toBe('Test Movie');
    expect(component['editMode']()).toBe(false);
  });

  it('computes watched status from the watched field', () => {
    expect(component['watched']()).toBe(false);

    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG], watched: true }));
    fixture.detectChanges();

    expect(component['watched']()).toBe(true);
  });

  it('computes favorite status from tags', () => {
    expect(component['favorite']()).toBe(false);

    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, FAVORITE_TAG] }));
    fixture.detectChanges();

    expect(component['favorite']()).toBe(true);
  });

  it('computes watch later status from list type', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'watch-later' }));
    fixture.detectChanges();

    expect(component['watchLater']()).toBe(true);
  });

  it('computes wishlist status from list type', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist' }));
    fixture.detectChanges();

    expect(component['wishlist']()).toBe(true);
  });

  it('returns collection item title for normal items', () => {
    expect(component['dialogTitle']()).toBe('Title.CollectionItem');
  });

  it('returns watch later item title for watch later items', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'watch-later' }));
    fixture.detectChanges();

    expect(component['dialogTitle']()).toBe('Title.WatchLaterItem');
  });

  it('returns wishlist item title for wishlist items', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist' }));
    fixture.detectChanges();

    expect(component['dialogTitle']()).toBe('Title.WishlistItem');
  });

  it('returns series tracker item title for series tracker items', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'series-tracker', tags: [SERIES_TAG] }));
    fixture.detectChanges();

    expect(component['dialogTitle']()).toBe('Title.SeriesTrackerItem');
  });

  it('uses contextual edit and delete action labels', () => {
    expect(component['translations'].edit()).toBe('EditCollectionItem');
    expect(component['translations'].delete()).toBe('DeleteFromCollection');

    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'watch-later' }));
    fixture.detectChanges();
    expect(component['translations'].delete()).toBe('DeleteFromWatchLater');

    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist' }));
    fixture.detectChanges();
    expect(component['translations'].delete()).toBe('DeleteFromWishlist');

    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'series-tracker', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    expect(component['translations'].edit()).toBe('EditSeriesTrackerItem');
    expect(component['translations'].delete()).toBe('DeleteFromSeriesTracker');

    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'movie-tracker' }));
    fixture.detectChanges();
    expect(component['translations'].edit()).toBe('EditMovieTrackerItem');
    expect(component['translations'].delete()).toBe('DeleteFromMovieTracker');
  });

  it('uses incoming share permissions for shared collection items', () => {
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: true,
      },
    ]);
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'owner-code' }));
    fixture.detectChanges();

    expect(component['isShared']()).toBe(true);
    expect(component['library']()).toBe('Owner');
    expect(component['permissionUpdate']()).toBe(false);
    expect(component['permissionDelete']()).toBe(true);
  });

  it('does not allow shared item changes when share permissions are not loaded', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'owner-code' }));
    fixture.detectChanges();

    expect(component['isShared']()).toBe(false);
    expect(component['permissionUpdate']()).toBe(false);
    expect(component['permissionDelete']()).toBe(false);
  });

  it('allows changes for the current user library by share code', () => {
    sharesState.setState('userShareCode', 'own-code');
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'own-code' }));
    fixture.detectChanges();

    expect(component['permissionUpdate']()).toBe(true);
    expect(component['permissionDelete']()).toBe(true);
  });

  it('passes the owner share code when changing a shared item', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'owner-code' }));
    fixture.detectChanges();
    component['form'].title().value.set('Updated Shared Title');

    await component['onSaveChanges']();

    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ title: 'Updated Shared Title' }),
      'testhash',
      'owner-code'
    );
  });

  it('passes the owner share code when deleting a shared item', () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'owner-code' }));
    fixture.detectChanges();

    component['onDelete']();

    expect(api.delete).toHaveBeenCalledWith('tt1234567', 'testhash', 'owner-code');
  });

  it('computes genre and tags text from draft item', () => {
    expect(component['genreText']()).toBe('Drama, Thriller');
    expect(component['tagsText']()).toBe(`${MOVIE_TAG} #action`);
  });

  it('hides the internal watch later tag from editable tag text', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, '#action', WATCH_LATER_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['tagsText']()).toBe(`${MOVIE_TAG} #action`);
  });

  it('hides the internal wishlist tag from editable tag text', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, '#action', WISHLIST_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['tagsText']()).toBe(`${MOVIE_TAG} #action`);
  });

  it('hides completed from editable tag text', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, COMPLETED_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['tagsText']()).toBe(`${MOVIE_TAG} #action`);
  });

  it('hides favorite from editable tag text', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, FAVORITE_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['tagsText']()).toBe(`${MOVIE_TAG} #action`);
  });

  it('keeps watched as editable custom tag text', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, CUSTOM_WATCHED_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['tagsText']()).toBe(`${MOVIE_TAG} ${CUSTOM_WATCHED_TAG} #action`);
  });

  it('hides the internal watch later tag from detail tags', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, '#action', WATCH_LATER_TAG] }));
    fixture.detectChanges();

    expect(component['detailTags']()).toEqual(['#action']);
    expect(component['systemTags']()).toEqual([MOVIE_TAG]);
  });

  it('hides the internal wishlist tag from detail tags', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, '#action', WISHLIST_TAG] }));
    fixture.detectChanges();

    expect(component['detailTags']()).toEqual(['#action']);
    expect(component['systemTags']()).toEqual([MOVIE_TAG]);
  });

  it('shows completed in system tags', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, COMPLETED_TAG, '#action'] }));
    fixture.detectChanges();

    expect(component['detailTags']()).toEqual(['#action']);
    expect(component['systemTags']()).toEqual([MOVIE_TAG, COMPLETED_TAG]);
  });

  it('shows favorite in system tags', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, FAVORITE_TAG, '#action'] }));
    fixture.detectChanges();

    expect(component['detailTags']()).toEqual(['#action']);
    expect(component['systemTags']()).toEqual([MOVIE_TAG, FAVORITE_TAG]);
  });

  it('shows watched as a custom detail tag', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, CUSTOM_WATCHED_TAG, '#action'] }));
    fixture.detectChanges();

    expect(component['detailTags']()).toEqual([CUSTOM_WATCHED_TAG, '#action']);
    expect(component['systemTags']()).toEqual([MOVIE_TAG]);
  });

  it('detects system display tags', () => {
    expect(isSystemDisplayTag(MOVIE_TAG)).toBe(true);
    expect(isSystemDisplayTag(SERIES_TAG)).toBe(true);
    expect(isSystemDisplayTag(FAVORITE_TAG)).toBe(true);
    expect(isSystemDisplayTag(COMPLETED_TAG)).toBe(true);
    expect(isSystemDisplayTag('#action')).toBe(false);
  });

  it('uses N/A when series tracker episode progress is not set', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'series-tracker', tags: [SERIES_TAG] }));
    fixture.detectChanges();

    expect(component['episodeProgressText']()).toBe('Fallback.NotAvailable');
  });

  it('loads watched episodes on init for series tracker items', () => {
    api.getSeriesTrackerWatchedEpisodes.mockReturnValue(
      of({ watchedEpisodes: [{ season: 1, episode: 2 }], lastWatchedEpisode: { season: 1, episode: 2 } })
    );
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'series-tracker', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(api.getSeriesTrackerWatchedEpisodes).toHaveBeenCalledWith('tt1234567');
    expect(component['watchedEpisodes']()).toEqual([{ season: 1, episode: 2 }]);
    expect(component['episodeProgressText']()).toBe('S01E02');
  });

  it('opens watched episodes dialog on manage watched episodes', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'series-tracker', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component['watchedEpisodes'].set([{ season: 1, episode: 2 }]);

    component['onManageWatchedEpisodes']();

    expect(portal.openStacked).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        imdbId: 'tt1234567',
        saved: expect.any(Function),
      })
    );
  });

  it('reports all episodes watched only when every available episode is watched', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'series-tracker', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component['seriesSeasons'].set([{ season: 1, episodes: 2 }]);
    component['seriesSeasonsLoaded'].set(true);
    component['watchedEpisodes'].set([{ season: 1, episode: 1 }]);
    component['watchedEpisodesLoaded'].set(true);

    expect(component['allEpisodesWatched']()).toBe(false);

    component['watchedEpisodes'].set([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);

    expect(component['allEpisodesWatched']()).toBe(true);
  });

  it('does not report all episodes watched without season metadata', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'series-tracker', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component['seriesSeasons'].set([]);
    component['seriesSeasonsLoaded'].set(true);
    component['watchedEpisodes'].set([{ season: 1, episode: 1 }]);
    component['watchedEpisodesLoaded'].set(true);

    expect(component['allEpisodesWatched']()).toBe(false);
  });

  it('uses completed tag while watched episode data is loading', () => {
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'series-tracker', tags: [SERIES_TAG, COMPLETED_TAG] })
    );
    fixture.detectChanges();

    expect(component['allEpisodesWatched']()).toBe(true);
  });

  it('opens the manual series metadata dialog', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'series-tracker', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component['seriesSeasons'].set([{ season: 1, episodes: 2 }]);

    component['onManageSeriesMetadata']();

    expect(portal.openStacked).toHaveBeenCalledWith(SeriesSeasonMetadataDialog, {
      imdbId: 'tt1234567',
      initialSeasons: [{ season: 1, episodes: 2 }],
      saved: expect.any(Function),
    });
  });

  it('deletes an item after confirmation', () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    confirm.open.mockReturnValue(of(true));

    component['onDelete']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith('tt1234567', 'testhash', undefined);
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith('tt1234567', undefined);
    expect(collectionService.triggerReload).toHaveBeenCalled();
    expect(portal.closeAll).toHaveBeenCalled();
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(toastState.state.message()).toBe('Toast.DeleteItem');
  });

  it('does not delete when confirmation is declined', () => {
    confirm.open.mockReturnValue(of(false));

    component['onDelete']();

    expect(api.delete).not.toHaveBeenCalled();
    expect(collectionService.deleteCollectionItem).not.toHaveBeenCalled();
    expect(portal.closeAll).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('saves changes after confirmation and updates state', async () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    confirm.open.mockReturnValue(of(true));
    component['form'].title().value.set('Updated Title');

    await component['onSaveChanges']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ title: 'Updated Title' }),
      'testhash',
      undefined
    );
    expect(collectionService.updateCollectionItem).toHaveBeenCalledWith(
      'tt1234567',
      expect.any(Object),
      undefined,
      'library'
    );
    expect(collectionService.triggerReload).toHaveBeenCalled();
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(toastState.state.message()).toBe('Toast.EditItem');
    expect(component['editMode']()).toBe(false);
  });

  it('saves movie tracker item changes against the movie tracker list', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'movie-tracker', watched: true }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].title().value.set('Updated Title');

    await component['onSaveChanges']();

    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ title: 'Updated Title' }),
      'testhash',
      undefined,
      'movie-tracker'
    );
  });

  it('saves edited external ratings', async () => {
    confirm.open.mockReturnValue(of(true));
    component['form'].rate().value.set('8.6');
    component['form'].rottenTomatoesRate().value.set('97%');
    component['form'].metacriticRate().value.set('86/100');

    await component['onSaveChanges']();

    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ rate: '8.6', rottenTomatoesRate: '97%', metacriticRate: '86/100' }),
      'testhash',
      undefined
    );
  });

  it('validates edited IMDb rate format', async () => {
    for (const validRate of ['', '0', '0.0', '8.5', '10', '10.0']) {
      component['form'].rate().value.set(validRate);
      expect(component['formErrors'].rate.rateFormat()).toBe(false);
    }

    for (const invalidRate of ['10.1', '8.55', '-1', 'abc']) {
      component['form'].rate().value.set(invalidRate);
      expect(component['formErrors'].rate.rateFormat()).toBe(true);
    }

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('validates edited Rotten Tomatoes rate format', async () => {
    for (const validRate of ['', '0%', '96%', '100%']) {
      component['form'].rottenTomatoesRate().value.set(validRate);
      expect(component['formErrors'].rottenTomatoesRate.rateFormat()).toBe(false);
    }

    for (const invalidRate of ['101%', '96', '96.5%', 'abc']) {
      component['form'].rottenTomatoesRate().value.set(invalidRate);
      expect(component['formErrors'].rottenTomatoesRate.rateFormat()).toBe(true);
    }

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('validates edited Metacritic rate format', async () => {
    for (const validRate of ['', '0/100', '59/100', '100/100']) {
      component['form'].metacriticRate().value.set(validRate);
      expect(component['formErrors'].metacriticRate.rateFormat()).toBe(false);
    }

    for (const invalidRate of ['101/100', '59', '59/10', '59%', 'abc']) {
      component['form'].metacriticRate().value.set(invalidRate);
      expect(component['formErrors'].metacriticRate.rateFormat()).toBe(true);
    }

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('preserves favorite when saving regular edits', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, FAVORITE_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].title().value.set('Updated Title');

    await component['onSaveChanges']();

    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ tags: [MOVIE_TAG, '#action', FAVORITE_TAG] }),
      'testhash',
      undefined
    );
  });

  it('does not send completed when saving regular edits', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, COMPLETED_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].title().value.set('Updated Title');

    await component['onSaveChanges']();

    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ tags: [MOVIE_TAG, '#action'] }),
      'testhash',
      undefined
    );
  });

  it('clears external ratings when changing the IMDb ID', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ rottenTomatoesRate: '96%', metacriticRate: '85/100' }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].IMDbId().value.set('tt7654321');

    await component['onSaveChanges']();

    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ IMDbId: 'tt7654321', rottenTomatoesRate: '', metacriticRate: '' }),
      'testhash',
      undefined
    );
  });

  it('does not save when confirmation is declined', async () => {
    confirm.open.mockReturnValue(of(false));
    component['form'].title().value.set('Updated Title');

    await component['onSaveChanges']();

    expect(api.update).not.toHaveBeenCalled();
    expect(collectionService.updateCollectionItem).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('does not save when title is empty', async () => {
    component['form'].title().value.set('  ');

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('does not save when IMDbId is empty', async () => {
    component['form'].IMDbId().value.set('  ');

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('does not save when tags contain virtual tags', async () => {
    component['form'].tagsText().value.set(`${MOVIE_TAG} ${VIRTUAL_UNWATCHED_TAG}`);

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('shows an internal tag error when tags contain server-managed tags', async () => {
    component['form'].tagsText().value.set(`${MOVIE_TAG} ${COMPLETED_TAG}`);

    await component['onSaveChanges']();

    expect(component['formErrors'].tagsText.usedInternalTag()).toBe(true);
    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('shows an internal tag error when tags contain user action tags', async () => {
    component['form'].tagsText().value.set(`${MOVIE_TAG} ${FAVORITE_TAG}`);

    await component['onSaveChanges']();

    expect(component['formErrors'].tagsText.usedInternalTag()).toBe(true);
    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('does not save when a normal item is changed to watch later', async () => {
    component['form'].tagsText().value.set(`${MOVIE_TAG} ${WATCH_LATER_TAG}`);

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('does not save when a normal item is changed to wishlist', async () => {
    component['form'].tagsText().value.set(`${MOVIE_TAG} ${WISHLIST_TAG}`);

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('does not save when a watch later item is edited through the normal item flow', async () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'watch-later' }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].tagsText().value.set(`${MOVIE_TAG} ${WATCH_LATER_TAG} #custom`);

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('does not update watch later items', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'watch-later' }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].tagsText().value.set(`${MOVIE_TAG} #later`);

    await component['onSaveChanges']();

    expect(api.update).not.toHaveBeenCalled();
  });

  it('does not update wishlist items', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist' }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].tagsText().value.set(`${MOVIE_TAG} #wishlist-custom`);

    await component['onSaveChanges']();

    expect(api.update).not.toHaveBeenCalled();
  });

  it('does not save when tags lack a type tag', async () => {
    component['form'].tagsText().value.set('#action');

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('allows series tag as valid type tag', async () => {
    confirm.open.mockReturnValue(of(true));
    component['form'].tagsText().value.set(`${SERIES_TAG} #drama`);

    await component['onSaveChanges']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalled();
  });

  it('allows tracker actions for library series items', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();

    expect(component['permissionWatch']()).toBe(true);
  });

  it('marks item as watched by copying it to movie tracker', async () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');

    await component['onMarkAsWatched']();

    expect(api.addMovieTrackerItem).toHaveBeenCalledWith('tt1234567', undefined);
    expect(collectionService.addCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ listType: 'movie-tracker' }),
      true
    );
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(toastState.state.message()).toBe('Toast.EditItem');
  });

  it('moves watch later movie items to movie tracker', async () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'watch-later', ownerShareCode: 'own-code', tags: [MOVIE_TAG] })
    );
    fixture.detectChanges();
    component.ngOnInit();

    await component['onMoveToMovieTracker']();

    expect(api.addMovieTrackerItem).toHaveBeenCalledWith('tt1234567', undefined, 'watch-later');
    expect(collectionService.addCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ listType: 'movie-tracker' }),
      true
    );
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith('tt1234567', 'own-code', 'watch-later');
    expect(component['movieTrackerExists']()).toBe(true);
    expect(component['movieTrackerHash']()).toBe('newhash');
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(portal.closeAll).toHaveBeenCalled();
  });

  it('moves watch later series items to series tracker', async () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'watch-later', ownerShareCode: 'own-code', tags: [SERIES_TAG] })
    );
    fixture.detectChanges();
    component.ngOnInit();

    await component['onMoveToSeriesTracker']();

    expect(api.addSeriesTrackerItem).toHaveBeenCalledWith('tt1234567', 'watch-later');
    expect(collectionService.addCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ listType: 'series-tracker' }),
      true
    );
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith('tt1234567', 'own-code', 'watch-later');
    expect(component['seriesTrackerExists']()).toBe(true);
    expect(component['seriesTrackerHash']()).toBe('newhash');
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(portal.closeAll).toHaveBeenCalled();
  });

  it('copies library series items to series tracker without deleting the source', async () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'library', ownerShareCode: 'owner-code', tags: [SERIES_TAG] })
    );
    fixture.detectChanges();
    component.ngOnInit();

    await component['onCopyToSeriesTracker']();

    expect(api.addSeriesTrackerItem).toHaveBeenCalledWith('tt1234567', undefined, 'owner-code');
    expect(collectionService.addCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ listType: 'series-tracker' }),
      true
    );
    expect(collectionService.deleteCollectionItem).not.toHaveBeenCalled();
    expect(component['seriesTrackerExists']()).toBe(true);
    expect(component['seriesTrackerHash']()).toBe('newhash');
    expect(collectionService.triggerReload).toHaveBeenCalled();
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
  });

  it('does not re-save when already watched', async () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG], watched: true }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    await component['onMarkAsWatched']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.addMovieTrackerItem).not.toHaveBeenCalled();
  });

  it('does not mark wishlist items as watched', async () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist', tags: [MOVIE_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    await component['onMarkAsWatched']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.addMovieTrackerItem).not.toHaveBeenCalled();
  });

  it('marks item as unwatched by removing the movie tracker item', async () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    fixture.componentRef.setInput('collectionItem', buildItem({ watched: true, tags: [MOVIE_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();

    await component['onMarkAsUnwatched']();

    expect(api.deleteMovieTrackerItem).toHaveBeenCalledWith('tt1234567');
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith('tt1234567', undefined, 'movie-tracker');
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(toastState.state.message()).toBe('Toast.EditItem');
  });

  it('marks item as favorite by appending favorite tag and saving', async () => {
    confirm.open.mockReturnValue(of(true));

    await component['onMarkAsFavorite']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ tags: expect.arrayContaining([FAVORITE_TAG]) }),
      'testhash',
      undefined
    );
    expect(toastState.state.message()).toBe('Toast.EditItem');
  });

  it('does not re-save when already favorite', async () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, FAVORITE_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    await component['onMarkAsFavorite']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('does not mark wishlist items as favorite', async () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, WISHLIST_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    await component['onMarkAsFavorite']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('removes favorite tag and saves', async () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, FAVORITE_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    await component['onRemoveFavorite']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ tags: expect.not.arrayContaining([FAVORITE_TAG]) }),
      'testhash',
      undefined
    );
    expect(toastState.state.message()).toBe('Toast.EditItem');
  });

  it('updates year to interval when valid', () => {
    component['form'].year().value.set('2026-2028');
    expect(component['form'].year().value()).toBe('2026-2028');
  });

  it('updates year to null when empty', () => {
    component['form'].year().value.set(null);
    expect(component['form'].year().value()).toBeNull();
  });

  it('sets posterImageFailed on image error', () => {
    expect(component['posterImageFailed']()).toBe(false);
    component['onPosterImageError']();
    expect(component['posterImageFailed']()).toBe(true);
  });

  it('uses translated poster alt text', () => {
    expect(component['translations'].altPoster()).toBe('Alt.Poster');
    expect(translate.translate).toHaveBeenCalledWith('Alt.Poster', { title: 'Test Movie' });
  });

  it('computes proxy image urls', () => {
    const apiState = TestBed.inject(apiStateToken);
    apiState.setState('apiUrl', 'http://localhost:3000');
    fixture.detectChanges();

    expect(component['imageUrl']()).toContain('/proxy/image?url=');
    expect(component['draftImageUrl']()).toContain('/proxy/image?url=');
  });

  it('computes trailer, imdb, and web search urls', () => {
    expect(component['trailerUrl']()).toContain('youtube.com');
    expect(component['imdbUrl']()).toBe('https://www.imdb.com/title/tt1234567/');
    expect(component['webSearchUrl']()).toContain('duckduckgo.com');
  });

  it('loads series tracker state for library series on init', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(api.collectionItemExists).toHaveBeenCalledWith('tt1234567', undefined, 'series-tracker');
  });

  it('loads movie tracker state for watch-later movie on init', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'watch-later', tags: [MOVIE_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(api.collectionItemExists).toHaveBeenCalledWith('tt1234567', undefined, 'movie-tracker');
  });

  it('loads series tracker state for watch-later series on init', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'watch-later', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(api.collectionItemExists).toHaveBeenCalledWith('tt1234567', undefined, 'series-tracker');
  });

  it('does not load tracker state for library movies on init', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(api.collectionItemExists).not.toHaveBeenCalled();
  });

  it('computes inSeriesTracker true when API says series tracker exists', () => {
    api.collectionItemExists.mockReturnValue(of({ exists: true, hash: 'tracker-hash' }));
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['inSeriesTracker']()).toBe(true);
    expect(component['seriesTrackerHash']()).toBe('tracker-hash');
  });

  it('computes inSeriesTracker false when API says series tracker does not exist', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['inSeriesTracker']()).toBe(false);
  });

  it('computes inMovieTracker true when API says movie tracker exists', () => {
    api.collectionItemExists.mockReturnValue(of({ exists: true, hash: 'movie-hash' }));
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'watch-later', tags: [MOVIE_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['inMovieTracker']()).toBe(true);
    expect(component['movieTrackerHash']()).toBe('movie-hash');
  });

  it('removes from series tracker after confirmation', () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    api.collectionItemExists.mockReturnValue(of({ exists: true, hash: 'tracker-hash' }));
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    component['onRemoveFromSeriesTracker']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith('tt1234567', 'tracker-hash', undefined, 'series-tracker');
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith('tt1234567', undefined, 'series-tracker');
    expect(collectionService.triggerReload).toHaveBeenCalled();
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(toastState.state.message()).toBe('Toast.DeleteItem');
    expect(component['seriesTrackerExists']()).toBe(false);
    expect(component['seriesTrackerHash']()).toBeUndefined();
  });

  it('does not remove from series tracker when confirmation is declined', () => {
    api.collectionItemExists.mockReturnValue(of({ exists: true, hash: 'tracker-hash' }));
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(false));

    component['onRemoveFromSeriesTracker']();

    expect(api.delete).not.toHaveBeenCalled();
    expect(collectionService.deleteCollectionItem).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });
});
