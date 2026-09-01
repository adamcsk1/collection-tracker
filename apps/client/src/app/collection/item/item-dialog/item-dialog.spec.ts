import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, toastStateToken, type ToastState } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { CollectionItemApiModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialMainState, mainStateToken } from '../../../main/main-store';
import { initialSharesState, sharesStateToken, type SharesState } from '../../../shares/shares-store';
import { CollectionItemModel } from '../../collection-model';
import { CollectionService } from '../../collection-service';
import { ItemDialog } from './item-dialog';
import { SeriesSeasonMetadataDialog } from '../../tracking/series-season-metadata-dialog/series-season-metadata-dialog';
import { ItemShareDialog } from '../item-share-dialog/item-share-dialog';

const CUSTOM_WATCHED_TAG = '#watched';
const COMPLETED_TAG = '#completed';
const FAVORITE_TAG = '#favorite';
const MOVIE_TAG = '#movie';
const SERIES_TAG = '#series';
const CUSTOM_UNWATCHED_TAG = '#unwatched';
const WATCH_LATER_TAG = '#watchlist';
const WISHLIST_TAG = '#wishlist';

const getContentType = (tags: string[]): CollectionItemModel['contentType'] =>
  tags.includes(SERIES_TAG) && !tags.includes(MOVIE_TAG) ? 'series' : 'movie';

const getCustomTags = (tags: string[]): string[] =>
  tags.filter(
    (tag) => ![MOVIE_TAG, SERIES_TAG, FAVORITE_TAG, COMPLETED_TAG, WATCH_LATER_TAG, WISHLIST_TAG].includes(tag)
  );

const buildItem = (overrides: Partial<CollectionItemModel> = {}): CollectionItemModel => {
  const tags = overrides.tags ?? [MOVIE_TAG, '#action'];
  return {
    image: 'https://example.com/poster.jpg',
    title: 'Test Movie',
    titleLower: 'test movie',
    genre: ['Drama', 'Thriller'],
    IMDbId: 'tt1234567',
    externalProvider: 'omdb',
    externalItemId: 'tt1234567',
    tags: getCustomTags(tags),
    year: '2020',
    rate: '8.5',
    rottenTomatoesRate: '',
    metacriticRate: '',
    userRate: null,
    hash: 'testhash',
    actors: 'Actor One, Actor Two',
    plot: 'A test plot.',
    listType: 'library',
    contentType: getContentType(tags),
    favorite: tags.includes(FAVORITE_TAG),
    watchedAt: tags.includes(COMPLETED_TAG) ? '2025-01-01 00:00:00' : null,
    ...overrides,
  };
};

const buildApiItem = (overrides: Partial<CollectionItemApiModel> = {}): CollectionItemApiModel => ({
  ...buildItem({ ...overrides, hash: overrides.hash ?? 'newhash' }),
  ownerShareCode: overrides.ownerShareCode ?? 'own-code',
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
  let router: { navigate: ReturnType<typeof vi.fn> };
  let confirm: { open: ReturnType<typeof vi.fn> };
  let api: {
    deleteByExternalId: ReturnType<typeof vi.fn>;
    updateByExternalId: ReturnType<typeof vi.fn>;
    getTrackingSeasonsByExternalId: ReturnType<typeof vi.fn>;
    getTrackingCompletedEpisodesByExternalId: ReturnType<typeof vi.fn>;
    updateTrackingCompletedEpisodesByExternalId: ReturnType<typeof vi.fn>;
    refreshTrackingSeasonsByExternalId: ReturnType<typeof vi.fn>;
    deleteTrackingSeasonsByExternalId: ReturnType<typeof vi.fn>;
    markAllTrackingCompletedByExternalId: ReturnType<typeof vi.fn>;
    addCompletedItemByExternalId: ReturnType<typeof vi.fn>;
    addTrackingItemByExternalId: ReturnType<typeof vi.fn>;
    deleteCompletedItemByExternalId: ReturnType<typeof vi.fn>;
    collectionItemExists: ReturnType<typeof vi.fn>;
    getMatchedItems: ReturnType<typeof vi.fn>;
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
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    confirm = { open: vi.fn() };
    api = {
      deleteByExternalId: vi.fn(() => of(undefined)),
      updateByExternalId: vi.fn(() => of({ item: buildApiItem() })),
      getTrackingSeasonsByExternalId: vi.fn(() => of({ seasons: [] })),
      getTrackingCompletedEpisodesByExternalId: vi.fn(() => of({ completedEpisodes: [], lastCompletedEpisode: null })),
      updateTrackingCompletedEpisodesByExternalId: vi.fn(() =>
        of({
          completedEpisodes: [],
          lastCompletedEpisode: null,
          item: buildApiItem({ listType: 'tracking', tags: [SERIES_TAG], hash: 'unwatched-hash' }),
        })
      ),
      refreshTrackingSeasonsByExternalId: vi.fn(() =>
        of({
          seasons: [{ season: 1, episodes: 2 }],
          item: buildApiItem({ listType: 'tracking', tags: [SERIES_TAG], hash: 'refreshed-hash' }),
        })
      ),
      deleteTrackingSeasonsByExternalId: vi.fn(() =>
        of({
          seasons: [],
          item: buildApiItem({ listType: 'tracking', tags: [SERIES_TAG], hash: 'metadata-deleted-hash' }),
        })
      ),
      markAllTrackingCompletedByExternalId: vi.fn(() =>
        of({
          completedEpisodes: [
            { season: 1, episode: 1 },
            { season: 1, episode: 2 },
          ],
          lastCompletedEpisode: { season: 1, episode: 2 },
          item: buildApiItem({ listType: 'tracking', tags: [SERIES_TAG, COMPLETED_TAG], hash: 'completed-hash' }),
        })
      ),
      addCompletedItemByExternalId: vi.fn(() => of({ item: buildApiItem({ listType: 'tracking', watched: true }) })),
      addTrackingItemByExternalId: vi.fn(() =>
        of({ item: buildApiItem({ listType: 'tracking', tags: [SERIES_TAG] }) })
      ),
      deleteCompletedItemByExternalId: vi.fn(() => of(undefined)),
      collectionItemExists: vi.fn(() => of({ exists: false })),
      getMatchedItems: vi.fn(() => of({ items: [], page: { limit: 1, hasMore: false, nextCursor: null } })),
    };
    translate = { translate: vi.fn((key: string) => key) };

    TestBed.configureTestingModule({
      imports: [ItemDialog],
      providers: [
        { provide: CollectionService, useValue: collectionService },
        { provide: PortalService, useValue: portal },
        { provide: Router, useValue: router },
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
    expect(component['form'].tagsText().value()).toBe('#action');
    expect(component['form'].contentType().value()).toBe('movie');
  });

  it('derives behavioral state across movie, series, and book list modes', () => {
    expect(component['genreText']()).toBe('Drama, Thriller');
    expect(component['tagsText']()).toBe('#action');
    expect(component['libraryItem']()).toBe(true);
    expect(component['movie']()).toBe(true);
    expect(component['permissionWatch']()).toBe(true);
    expect(component['dialogTitle']()).toBe('Title.CollectionItem');
    expect(component['dialogIcon']()).toBe('movie');
    expect(component['imdbUrl']()).toBe('https://www.imdb.com/title/tt1234567/');

    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ contentType: 'series', listType: 'tracking', watchedAt: '2026-01-01T00:00:00.000Z' })
    );
    fixture.detectChanges();

    expect(component['tracking']()).toBe(true);
    expect(component['series']()).toBe(true);
    expect(component['finished']()).toBe(false);
    expect(component['dialogTitle']()).toBe('Title.TrackingItem');
    expect(component['dialogIcon']()).toBe('live_tv');

    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ contentType: 'book', listType: 'books', externalProvider: 'openlibrary', externalItemId: 'book-id' })
    );
    fixture.detectChanges();

    expect(component['books']()).toBe(true);
    expect(component['book']()).toBe(true);
    expect(component['isbn']()).toBe('book-id');
    expect(component['dialogTitle']()).toBe('Title.BooksItem');
    expect(component['dialogIcon']()).toBe('menu_book');
  });

  it('initializes external rating fields from the input model', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ rottenTomatoesRate: '96%', metacriticRate: '85/100' }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['form'].rottenTomatoesRate().value()).toBe('96%');
    expect(component['form'].metacriticRate().value()).toBe('85/100');
  });

  it('toggles edit mode', () => {
    expect(component['translations'].backToDetails()).toBe('BackToDetails');
    expect(component['editMode']()).toBe(false);

    component['onEdit']();
    expect(component['editMode']()).toBe(true);

    component['onReadOnly']();
    expect(component['editMode']()).toBe(false);
  });

  it('renders form-associated edit footer controls with translated labels', () => {
    component['onEdit']();
    fixture.detectChanges();

    const backButton = fixture.nativeElement.querySelector(
      '[data-test-id="item-dialog-read-only"]'
    ) as HTMLButtonElement;
    const saveButton = fixture.nativeElement.querySelector('[data-test-id="item-dialog-save"]') as HTMLButtonElement;
    const saveLabel = fixture.nativeElement.querySelector('[data-test-id="item-dialog-save-label"]') as HTMLElement;

    expect(backButton.type).toBe('button');
    expect(backButton.getAttribute('aria-label')).toBe('BackToDetails');
    expect(backButton.title).toBe('BackToDetails');
    expect(saveButton.type).toBe('submit');
    expect(saveButton.getAttribute('form')).toBe('item-edit-form');
    expect(saveButton.getAttribute('aria-label')).toBe('Save');
    expect(saveButton.title).toBe('Save');
    expect(saveLabel.textContent?.trim()).toBe('Save');
    expect(saveButton.disabled).toBe(false);

    component['form'].title().value.set('');
    fixture.detectChanges();

    expect(saveButton.disabled).toBe(true);
  });

  it('restores last saved item when switching back to read-only', () => {
    component['onEdit']();
    component['form'].title().value.set('Modified Title');
    component['form'].contentType().value.set('series');
    expect(component['form'].title().value()).toBe('Modified Title');

    component['onReadOnly']();
    expect(component['form'].title().value()).toBe('Test Movie');
    expect(component['form'].contentType().value()).toBe('movie');
    expect(component['editMode']()).toBe(false);
  });

  it('computes watched status from the watched field', () => {
    expect(component['finished']()).toBe(false);

    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG], watched: true }));
    fixture.detectChanges();

    expect(component['finished']()).toBe(true);
  });

  it('computes favorite status from the favorite field', () => {
    expect(component['favorite']()).toBe(false);

    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, FAVORITE_TAG] }));
    fixture.detectChanges();

    expect(component['favorite']()).toBe(true);
  });

  it('computes watch later status from list type', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'up-next' }));
    fixture.detectChanges();

    expect(component['upNext']()).toBe(true);
  });

  it('computes wishlist status from list type', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist' }));
    fixture.detectChanges();

    expect(component['wishlist']()).toBe(true);
  });

  it('allows own wishlist item changes', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist' }));
    fixture.detectChanges();

    expect(component['permissionUpdate']()).toBe(true);
  });

  it('allows own watch later item changes', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'up-next' }));
    fixture.detectChanges();

    expect(component['permissionUpdate']()).toBe(true);
  });

  it('keeps watch later items with unavailable IMDb ratings valid in edit mode', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'up-next', rate: 'N/A' }));
    fixture.detectChanges();
    component.ngOnInit();
    component['onEdit']();

    expect(component['form'].rate().value()).toBe('N/A');
    expect(component['form']().invalid()).toBe(false);
  });

  it('normalizes IMDb ratings with /10 denominators before validating edit mode', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'up-next', rate: '8.0/10' }));
    fixture.detectChanges();
    component.ngOnInit();
    component['onEdit']();

    expect(component['form'].rate().value()).toBe('8.0');
    expect(component['form']().invalid()).toBe(false);
  });

  it('keeps wishlist items with unavailable IMDb ratings valid in edit mode', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist', rate: 'N/A' }));
    fixture.detectChanges();
    component.ngOnInit();
    component['onEdit']();

    expect(component['form'].rate().value()).toBe('N/A');
    expect(component['form']().invalid()).toBe(false);
  });

  it('returns collection item title for normal items', () => {
    expect(component['dialogTitle']()).toBe('Title.CollectionItem');
  });

  it('returns watch later item title for watch later items', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'up-next' }));
    fixture.detectChanges();

    expect(component['dialogTitle']()).toBe('Title.UpNextItem');
  });

  it('returns wishlist item title for wishlist items', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist' }));
    fixture.detectChanges();

    expect(component['dialogTitle']()).toBe('Title.WishlistItem');
  });

  it('returns tracking item title for tracking items', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'tracking', tags: [SERIES_TAG] }));
    fixture.detectChanges();

    expect(component['dialogTitle']()).toBe('Title.TrackingItem');
  });

  it('returns books list title and ISBN for books list items', () => {
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({
        listType: 'books',
        contentType: 'book',
        externalProvider: 'openlibrary',
        externalItemId: 'OL7353617M',
        externalIds: [{ source: 'isbn', id: '9780441172719' }],
      })
    );
    fixture.detectChanges();

    expect(component['dialogTitle']()).toBe('Title.BooksItem');
    expect(component['isbn']()).toBe('9780441172719');
    expect(component['permissionWatch']()).toBe(true);
  });

  it('uses contextual edit and delete action labels', () => {
    expect(component['translations'].edit()).toBe('EditCollectionItem');
    expect(component['translations'].delete()).toBe('DeleteFromCollection');

    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'up-next' }));
    fixture.detectChanges();
    expect(component['translations'].edit()).toBe('EditUpNextItem');
    expect(component['translations'].delete()).toBe('DeleteFromUpNext');

    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist' }));
    fixture.detectChanges();
    expect(component['translations'].edit()).toBe('EditWishlistItem');
    expect(component['translations'].delete()).toBe('DeleteFromWishlist');

    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'tracking', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    expect(component['translations'].edit()).toBe('EditTrackingItem');
    expect(component['translations'].delete()).toBe('DeleteFromTracking');

    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'tracking' }));
    fixture.detectChanges();
    expect(component['translations'].edit()).toBe('EditTrackingItem');
    expect(component['translations'].delete()).toBe('DeleteFromTracking');

    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'books', contentType: 'book', externalProvider: 'openlibrary' })
    );
    fixture.detectChanges();
    expect(component['translations'].edit()).toBe('EditBooksItem');
    expect(component['translations'].delete()).toBe('DeleteFromBooks');
  });

  it('uses incoming share permissions for shared collection items', () => {
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
            canDelete: true,
            readMode: 'all',
          },
          {
            listType: 'library',
            contentType: 'series',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: true,
            readMode: 'all',
          },
        ],
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

  it('opens item sharing as a stacked dialog for an owned item', () => {
    component['onShare']();

    expect(portal.openStacked).toHaveBeenCalledWith(ItemShareDialog, {
      externalProvider: 'omdb',
      externalItemId: 'tt1234567',
      listType: 'library',
      itemTitle: 'Test Movie',
    });
  });

  it('does not open item sharing for a received item or during edit mode', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'owner-code' }));
    fixture.detectChanges();
    component['onShare']();

    expect(portal.openStacked).not.toHaveBeenCalled();

    fixture.componentRef.setInput('collectionItem', buildItem());
    fixture.detectChanges();
    component['onEdit']();
    component['onShare']();

    expect(portal.openStacked).not.toHaveBeenCalled();
  });

  it('passes the owner share code when changing a shared item', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'owner-code' }));
    fixture.detectChanges();
    component['form'].title().value.set('Updated Shared Title');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
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

    expect(api.deleteByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', 'testhash', 'owner-code');
  });

  it('computes genre and tags text from draft item', () => {
    expect(component['genreText']()).toBe('Drama, Thriller');
    expect(component['tagsText']()).toBe('#action');
  });

  it('keeps the former watch later tag in editable tag text', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, '#action', WATCH_LATER_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['tagsText']()).toBe(`${MOVIE_TAG} #action ${WATCH_LATER_TAG}`);
  });

  it('keeps the former wishlist tag in editable tag text', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, '#action', WISHLIST_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['tagsText']()).toBe(`${MOVIE_TAG} #action ${WISHLIST_TAG}`);
  });

  it('keeps completed in editable tag text', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, COMPLETED_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['tagsText']()).toBe(`${MOVIE_TAG} ${COMPLETED_TAG} #action`);
  });

  it('keeps favorite in editable tag text', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, FAVORITE_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['tagsText']()).toBe(`${MOVIE_TAG} ${FAVORITE_TAG} #action`);
  });

  it('keeps watched as editable custom tag text', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, CUSTOM_WATCHED_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['tagsText']()).toBe(`${MOVIE_TAG} ${CUSTOM_WATCHED_TAG} #action`);
  });

  it('keeps the former watch later tag in detail tags', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, '#action', WATCH_LATER_TAG] }));
    fixture.detectChanges();

    expect(component['detailTags']()).toEqual([MOVIE_TAG, '#action', WATCH_LATER_TAG]);
  });

  it('keeps the former wishlist tag in detail tags', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, '#action', WISHLIST_TAG] }));
    fixture.detectChanges();

    expect(component['detailTags']()).toEqual([MOVIE_TAG, '#action', WISHLIST_TAG]);
  });

  it('keeps completed in detail tags', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, COMPLETED_TAG, '#action'] }));
    fixture.detectChanges();

    expect(component['detailTags']()).toEqual([MOVIE_TAG, COMPLETED_TAG, '#action']);
  });

  it('keeps favorite in detail tags', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, FAVORITE_TAG, '#action'] }));
    fixture.detectChanges();

    expect(component['detailTags']()).toEqual([MOVIE_TAG, FAVORITE_TAG, '#action']);
  });

  it('shows watched as a custom detail tag', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, CUSTOM_WATCHED_TAG, '#action'] }));
    fixture.detectChanges();

    expect(component['detailTags']()).toEqual([MOVIE_TAG, CUSTOM_WATCHED_TAG, '#action']);
  });

  it('uses N/A when tracking episode progress is not set', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'tracking', tags: [SERIES_TAG] }));
    fixture.detectChanges();

    expect(component['episodeProgressText']()).toBe('Fallback.NotAvailable');
  });

  it('loads watched episodes on init for tracking items', () => {
    api.getTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({ completedEpisodes: [{ season: 1, episode: 2 }], lastCompletedEpisode: { season: 1, episode: 2 } })
    );
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'tracking', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(api.getTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567');
    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 2 }]);
    expect(component['episodeProgressText']()).toBe('S01E02');
  });

  it('loads shared owner tracking data using owner share code', () => {
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'tracking', tags: [SERIES_TAG], ownerShareCode: 'owner-code' })
    );
    fixture.detectChanges();

    component.ngOnInit();

    expect(api.getTrackingSeasonsByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', 'owner-code');
    expect(api.getTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', 'owner-code');
  });

  it('opens watched episodes dialog on manage watched episodes', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'tracking', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component['completedEpisodes'].set([{ season: 1, episode: 2 }]);

    component['onManageCompletedEpisodes']();

    expect(portal.openStacked).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        imdbId: 'tt1234567',
        saved: expect.any(Function),
      })
    );
  });

  it('threads shared owner code to tracking management dialogs', () => {
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        grants: [
          {
            listType: 'tracking',
            contentType: 'series',
            canRead: true,
            canCreate: false,
            canUpdate: true,
            canDelete: false,
            readMode: 'all',
          },
        ],
      },
    ]);
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'tracking', tags: [SERIES_TAG], ownerShareCode: 'owner-code' })
    );
    fixture.detectChanges();

    component['onManageSeriesMetadata']();
    component['onManageCompletedEpisodes']();

    expect(portal.openStacked).toHaveBeenNthCalledWith(
      1,
      SeriesSeasonMetadataDialog,
      expect.objectContaining({ ownerShareCode: 'owner-code', canUpdate: true })
    );
    expect(portal.openStacked).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      expect.objectContaining({ ownerShareCode: 'owner-code' })
    );
  });

  it('reports all episodes completed only when every available episode is completed', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'tracking', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component['seriesSeasons'].set([{ season: 1, episodes: 2 }]);
    component['seriesSeasonsLoaded'].set(true);
    component['completedEpisodes'].set([{ season: 1, episode: 1 }]);
    component['completedEpisodesLoaded'].set(true);

    expect(component['allEpisodesCompleted']()).toBe(false);

    component['completedEpisodes'].set([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);

    expect(component['allEpisodesCompleted']()).toBe(true);
  });

  it('does not report all episodes completed without season metadata', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'tracking', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component['seriesSeasons'].set([]);
    component['seriesSeasonsLoaded'].set(true);
    component['completedEpisodes'].set([{ season: 1, episode: 1 }]);
    component['completedEpisodesLoaded'].set(true);

    expect(component['allEpisodesCompleted']()).toBe(false);
  });

  it('uses completed tag while completed episode data is loading', () => {
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'tracking', tags: [SERIES_TAG, COMPLETED_TAG] })
    );
    fixture.detectChanges();

    expect(component['allEpisodesCompleted']()).toBe(true);
  });

  it('opens the manual series metadata dialog', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'tracking', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component['seriesSeasons'].set([{ season: 1, episodes: 2 }]);

    component['onManageSeriesMetadata']();

    expect(portal.openStacked).toHaveBeenCalledWith(SeriesSeasonMetadataDialog, {
      imdbId: 'tt1234567',
      canUpdate: true,
      initialSeasons: [{ season: 1, episodes: 2 }],
      saved: expect.any(Function),
    });
  });

  it('deletes an item after confirmation', () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    confirm.open.mockReturnValue(of(true));

    component['onDelete']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.deleteByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', 'testhash', undefined);
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ externalProvider: 'omdb', externalItemId: 'tt1234567' }),
      undefined
    );
    expect(collectionService.triggerReload).toHaveBeenCalled();
    expect(portal.closeAll).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { item: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(toastState.state.message()).toBe('Toast.DeleteItem');
  });

  it('does not delete when confirmation is declined', () => {
    confirm.open.mockReturnValue(of(false));

    component['onDelete']();

    expect(api.deleteByExternalId).not.toHaveBeenCalled();
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
    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ title: 'Updated Title' }),
      'testhash',
      undefined
    );
    expect(collectionService.updateCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ externalProvider: 'omdb', externalItemId: 'tt1234567' }),
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

  it('saves tracking item changes against the tracking list', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'tracking', watched: true }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].title().value.set('Updated Title');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ title: 'Updated Title' }),
      'testhash',
      undefined,
      'tracking'
    );
  });

  it('revalidates book progress when the sibling field recovers the range', async () => {
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({
        listType: 'tracking',
        contentType: 'book',
        externalProvider: 'openlibrary',
        externalItemId: '9780306406157',
        IMDbId: undefined,
        progressCurrent: 50,
        progressTotal: 100,
      })
    );
    fixture.detectChanges();
    component.ngOnInit();
    component['onEdit']();

    component['form'].progressCurrent().value.set(150);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['formErrors'].progressCurrent.progressRange()).toBe(true);
    expect(component['form']().valid()).toBe(false);

    component['form'].progressTotal().value.set(200);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['formErrors'].progressCurrent.progressRange()).toBe(false);
    expect(component['formErrors'].progressTotal.progressRange()).toBe(false);
    expect(component['form']().valid()).toBe(true);
  });

  it('saves books list item changes against the books list list', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'books', contentType: 'book', externalProvider: 'openlibrary' })
    );
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].title().value.set('Updated Book');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'openlibrary',
      'tt1234567',
      expect.objectContaining({ title: 'Updated Book', contentType: 'book' }),
      'testhash',
      undefined,
      'books'
    );
  });

  it('saves edited external ratings', async () => {
    confirm.open.mockReturnValue(of(true));
    component['form'].rate().value.set('8.6');
    component['form'].rottenTomatoesRate().value.set('97%');
    component['form'].metacriticRate().value.set('86/100');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ rate: '8.6', rottenTomatoesRate: '97%', metacriticRate: '86/100' }),
      'testhash',
      undefined
    );
  });

  it('saves edited content type', async () => {
    confirm.open.mockReturnValue(of(true));
    component['form'].contentType().value.set('series');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ contentType: 'series' }),
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
    expect(api.updateByExternalId).not.toHaveBeenCalled();
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
    expect(api.updateByExternalId).not.toHaveBeenCalled();
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
    expect(api.updateByExternalId).not.toHaveBeenCalled();
  });

  it('preserves favorite when saving regular edits', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, FAVORITE_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].title().value.set('Updated Title');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ tags: [MOVIE_TAG, FAVORITE_TAG, '#action'], favorite: true }),
      'testhash',
      undefined
    );
  });

  it('preserves completed when saving regular edits', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, COMPLETED_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].title().value.set('Updated Title');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ tags: [MOVIE_TAG, COMPLETED_TAG, '#action'] }),
      'testhash',
      undefined
    );
  });

  it('clears external ratings when changing the IMDb ID', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({
        rottenTomatoesRate: '96%',
        metacriticRate: '85/100',
        externalIds: [
          { source: 'omdb', id: 'tt1234567' },
          { source: 'imdb', id: 'tt1234567' },
        ],
      })
    );
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].IMDbId().value.set('tt7654321');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({
        IMDbId: 'tt7654321',
        rottenTomatoesRate: '',
        metacriticRate: '',
        externalIds: [
          { source: 'omdb', id: 'tt7654321' },
          { source: 'imdb', id: 'tt7654321' },
        ],
      }),
      'testhash',
      undefined
    );
  });

  it('extracts IMDb id from URL when saving edited identity', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({
        externalIds: [
          { source: 'omdb', id: 'tt1234567' },
          { source: 'imdb', id: 'tt1234567' },
        ],
      })
    );
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].IMDbId().value.set('https://www.imdb.com/title/tt7654321/');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({
        IMDbId: 'tt7654321',
        externalItemId: 'tt7654321',
        externalIds: [
          { source: 'omdb', id: 'tt7654321' },
          { source: 'imdb', id: 'tt7654321' },
        ],
      }),
      'testhash',
      undefined
    );
  });

  it('does not save when confirmation is declined', async () => {
    confirm.open.mockReturnValue(of(false));
    component['form'].title().value.set('Updated Title');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).not.toHaveBeenCalled();
    expect(collectionService.updateCollectionItem).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('does not save when title is empty', async () => {
    component['form'].title().value.set('  ');

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.updateByExternalId).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('does not save when IMDbId is empty', async () => {
    component['form'].IMDbId().value.set('  ');

    await component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.updateByExternalId).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('saves former virtual tags as custom tags', async () => {
    confirm.open.mockReturnValue(of(true));
    component['form'].tagsText().value.set(CUSTOM_UNWATCHED_TAG);

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ tags: [CUSTOM_UNWATCHED_TAG], contentType: 'movie' }),
      'testhash',
      undefined
    );
  });

  it('saves former server-managed tags as custom tags', async () => {
    confirm.open.mockReturnValue(of(true));
    component['form'].tagsText().value.set(COMPLETED_TAG);

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ tags: [COMPLETED_TAG], contentType: 'movie' }),
      'testhash',
      undefined
    );
  });

  it('saves former user action tags as custom tags', async () => {
    confirm.open.mockReturnValue(of(true));
    component['form'].tagsText().value.set(FAVORITE_TAG);

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ tags: [FAVORITE_TAG], contentType: 'movie' }),
      'testhash',
      undefined
    );
  });

  it('saves former watch later tags as custom tags', async () => {
    confirm.open.mockReturnValue(of(true));
    component['form'].tagsText().value.set(WATCH_LATER_TAG);

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ tags: [WATCH_LATER_TAG], contentType: 'movie' }),
      'testhash',
      undefined
    );
  });

  it('saves former wishlist tags as custom tags', async () => {
    confirm.open.mockReturnValue(of(true));
    component['form'].tagsText().value.set(WISHLIST_TAG);

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ tags: [WISHLIST_TAG], contentType: 'movie' }),
      'testhash',
      undefined
    );
  });

  it('updates watch later items against the watch later list', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'up-next' }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].tagsText().value.set('#later');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ tags: ['#later'] }),
      'testhash',
      undefined,
      'up-next'
    );
  });

  it('updates wishlist items against the wishlist list', async () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist' }));
    fixture.detectChanges();
    component.ngOnInit();
    component['form'].tagsText().value.set('#wishlist-custom');

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ tags: ['#wishlist-custom'] }),
      'testhash',
      undefined,
      'wishlist'
    );
  });

  it('saves custom tags without a type tag', async () => {
    confirm.open.mockReturnValue(of(true));
    component['form'].tagsText().value.set('#action');

    await component['onSaveChanges']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ tags: ['#action'], contentType: 'movie' }),
      'testhash',
      undefined
    );
  });

  it('saves former type tags as custom tags', async () => {
    confirm.open.mockReturnValue(of(true));
    component['form'].tagsText().value.set(`${SERIES_TAG} #drama`);

    await component['onSaveChanges']();

    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ tags: [SERIES_TAG, '#drama'], contentType: 'movie' }),
      'testhash',
      undefined
    );
  });

  it('allows tracker actions for library series items', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();

    expect(component['permissionWatch']()).toBe(true);
  });

  it('marks item as watched by copying it to tracking', async () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');

    await component['onMarkAsFinished']();

    expect(api.addCompletedItemByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', undefined, undefined);
    expect(collectionService.addCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ listType: 'tracking' }),
      true
    );
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(toastState.state.message()).toBe('Toast.EditItem');
  });

  it('does not run tracking actions when the feature is disabled', async () => {
    TestBed.inject(mainStateToken).setState('collectionFeaturePreferences', {
      ...initialMainState.collectionFeaturePreferences,
      tracking: false,
    });

    await component['onMarkAsFinished']();

    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'up-next', ownerShareCode: 'own-code', tags: [MOVIE_TAG] })
    );
    fixture.detectChanges();
    await component['onMoveToFinished']();

    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG], watched: true }));
    fixture.detectChanges();
    await component['onMarkAsUnfinished']();

    expect(api.addCompletedItemByExternalId).not.toHaveBeenCalled();
    expect(api.deleteCompletedItemByExternalId).not.toHaveBeenCalled();
  });

  it('moves watch later movie items to tracking', async () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'up-next', ownerShareCode: 'own-code', tags: [MOVIE_TAG] })
    );
    fixture.detectChanges();
    component.ngOnInit();

    await component['onMoveToFinished']();

    expect(api.addCompletedItemByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', undefined, 'up-next');
    expect(collectionService.addCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ listType: 'tracking' }),
      true
    );
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ externalProvider: 'omdb', externalItemId: 'tt1234567' }),
      'own-code',
      'up-next'
    );
    expect(component['finishedExists']()).toBe(true);
    expect(component['finishedHash']()).toBe('newhash');
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(portal.closeAll).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { item: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('moves watch later series items to tracking', async () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'up-next', ownerShareCode: 'own-code', tags: [SERIES_TAG] })
    );
    fixture.detectChanges();
    component.ngOnInit();

    await component['onMoveToTracking']();

    expect(api.addTrackingItemByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', 'up-next');
    expect(collectionService.addCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ listType: 'tracking' }),
      true
    );
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ externalProvider: 'omdb', externalItemId: 'tt1234567' }),
      'own-code',
      'up-next'
    );
    expect(component['trackingExists']()).toBe(true);
    expect(component['trackingHash']()).toBe('newhash');
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(portal.closeAll).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { item: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('copies library series items to tracking without deleting the source', async () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'library', ownerShareCode: 'owner-code', tags: [SERIES_TAG] })
    );
    fixture.detectChanges();
    component.ngOnInit();

    await component['onCopyToTracking']();

    expect(api.addTrackingItemByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', undefined, 'owner-code');
    expect(collectionService.addCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ listType: 'tracking' }),
      true
    );
    expect(collectionService.deleteCollectionItem).not.toHaveBeenCalled();
    expect(component['trackingExists']()).toBe(true);
    expect(component['trackingHash']()).toBe('newhash');
    expect(collectionService.triggerReload).toHaveBeenCalled();
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
  });

  it('does not run tracking actions when the feature is disabled', async () => {
    TestBed.inject(mainStateToken).setState('collectionFeaturePreferences', {
      ...initialMainState.collectionFeaturePreferences,
      tracking: false,
    });
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'library', tags: [SERIES_TAG] }));
    fixture.detectChanges();

    await component['onCopyToTracking']();

    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({ listType: 'up-next', ownerShareCode: 'own-code', tags: [SERIES_TAG] })
    );
    fixture.detectChanges();
    await component['onMoveToTracking']();

    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'library', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component['trackingExists'].set(true);
    component['trackingHash'].set('tracker-hash');
    await component['onRemoveFromTracking']();

    expect(api.addTrackingItemByExternalId).not.toHaveBeenCalled();
    expect(api.deleteByExternalId).not.toHaveBeenCalled();
  });

  it('does not re-save when already watched', async () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG], watched: true }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    await component['onMarkAsFinished']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.addCompletedItemByExternalId).not.toHaveBeenCalled();
  });

  it('does not mark wishlist items as watched', async () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist', tags: [MOVIE_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    await component['onMarkAsFinished']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.addCompletedItemByExternalId).not.toHaveBeenCalled();
  });

  it('marks item as unwatched by removing the tracking item', async () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    fixture.componentRef.setInput('collectionItem', buildItem({ watched: true, tags: [MOVIE_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();

    await component['onMarkAsUnfinished']();

    expect(api.deleteCompletedItemByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567');
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ externalProvider: 'omdb', externalItemId: 'tt1234567' }),
      undefined,
      'tracking'
    );
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(toastState.state.message()).toBe('Toast.EditItem');
  });

  it('marks book as unfinished by clearing completion on the tracking twin', async () => {
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({
        listType: 'books',
        watched: true,
        tags: [],
        contentType: 'book',
        externalProvider: 'openlibrary',
        externalItemId: '9780306406157',
      })
    );
    fixture.detectChanges();
    component.ngOnInit();

    await component['onMarkAsUnfinished']();

    expect(api.deleteCompletedItemByExternalId).toHaveBeenCalledWith('openlibrary', '9780306406157');
    expect(collectionService.deleteCollectionItem).not.toHaveBeenCalled();
    expect(collectionService.updateCollectionItem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ listType: 'tracking', externalItemId: '9780306406157' }),
      expect.objectContaining({ listType: 'tracking', watched: false, watchedAt: null }),
      undefined,
      'tracking'
    );
    expect(collectionService.updateCollectionItem).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ listType: 'books' }),
      expect.objectContaining({ listType: 'books', watched: false }),
      undefined,
      'books'
    );
  });

  it('marks item as favorite and saves', async () => {
    confirm.open.mockReturnValue(of(true));

    await component['onMarkAsFavorite']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ favorite: true, tags: ['#action'] }),
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
    expect(api.updateByExternalId).not.toHaveBeenCalled();
  });

  it('does not mark wishlist items as favorite', async () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'wishlist', tags: [MOVIE_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    await component['onMarkAsFavorite']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.updateByExternalId).not.toHaveBeenCalled();
  });

  it('removes favorite and saves', async () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, FAVORITE_TAG, '#action'] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    await component['onRemoveFavorite']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.updateByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt1234567',
      expect.objectContaining({ favorite: false, tags: [MOVIE_TAG, FAVORITE_TAG, '#action'] }),
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

    expect(component['imageUrl']()).toContain('/images/proxy?url=');
    expect(component['draftImageUrl']()).toContain('/images/proxy?url=');
  });

  it('computes trailer, imdb, and web search urls', () => {
    expect(component['trailerUrl']()).toContain('youtube.com');
    expect(component['imdbUrl']()).toBe('https://www.imdb.com/title/tt1234567/');
    expect(component['webSearchUrl']()).toContain('duckduckgo.com');
  });

  it('loads tracking state for library series on init', () => {
    const externalIds = [{ source: 'imdb' as const, id: 'tt1234567' }];
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG], externalIds }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(api.collectionItemExists).toHaveBeenCalledWith('omdb', 'tt1234567', undefined, 'tracking', externalIds);
  });

  it('loads tracking state for upNext movie on init', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'up-next', tags: [MOVIE_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(api.collectionItemExists).toHaveBeenCalledWith('omdb', 'tt1234567', undefined, 'tracking', undefined);
  });

  it('loads tracking state for upNext series on init', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'up-next', tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(api.collectionItemExists).toHaveBeenCalledWith('omdb', 'tt1234567', undefined, 'tracking', undefined);
  });

  it('loads finished twin state for library movies on init', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(api.collectionItemExists).toHaveBeenCalledWith('omdb', 'tt1234567', undefined, 'tracking', undefined);
  });

  it('computes inTracking true when API says tracking exists', () => {
    api.collectionItemExists.mockReturnValue(of({ exists: true, hash: 'tracker-hash' }));
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['inTracking']()).toBe(true);
    expect(component['trackingHash']()).toBe('tracker-hash');
  });

  it('computes inTracking false when API says tracking does not exist', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['inTracking']()).toBe(false);
  });

  it('computes inFinished true when API says tracking exists', () => {
    api.collectionItemExists.mockReturnValue(of({ exists: true, hash: 'movie-hash' }));
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'up-next', tags: [MOVIE_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    expect(component['inFinished']()).toBe(true);
    expect(component['finishedHash']()).toBe('movie-hash');
  });

  it('removes from tracking after confirmation', () => {
    const spinnerSetState = vi.spyOn(spinnerLoadingState, 'setState');
    api.collectionItemExists.mockReturnValue(of({ exists: true, hash: 'tracker-hash' }));
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    component['onRemoveFromTracking']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.deleteByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', 'tracker-hash', undefined, 'tracking');
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ externalProvider: 'omdb', externalItemId: 'tt1234567' }),
      undefined,
      'tracking'
    );
    expect(collectionService.triggerReload).toHaveBeenCalled();
    expect(spinnerSetState).toHaveBeenCalledWith('show', true);
    expect(spinnerSetState).toHaveBeenCalledWith('show', false);
    expect(toastState.state.message()).toBe('Toast.DeleteItem');
    expect(component['trackingExists']()).toBe(false);
    expect(component['trackingHash']()).toBeUndefined();
  });

  it('does not remove from tracking when confirmation is declined', () => {
    api.collectionItemExists.mockReturnValue(of({ exists: true, hash: 'tracker-hash' }));
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(false));

    component['onRemoveFromTracking']();

    expect(api.deleteByExternalId).not.toHaveBeenCalled();
    expect(collectionService.deleteCollectionItem).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('opens the watching item dialog from a library series already in watching', async () => {
    const watchingItem = buildApiItem({ listType: 'tracking', tags: [SERIES_TAG], hash: 'watching-hash' });
    api.collectionItemExists.mockReturnValue(of({ exists: true, hash: 'watching-hash' }));
    api.getMatchedItems.mockReturnValue(
      of({ items: [watchingItem], page: { limit: 1, hasMore: false, nextCursor: null } })
    );
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();

    await component['onOpenInTracking']();

    expect(api.getMatchedItems).toHaveBeenCalledWith({
      identities: [{ source: 'omdb', id: 'tt1234567' }],
      limit: 1,
      filters: { listType: 'tracking', shared: 'mine' },
    });
    expect(portal.closeAll).toHaveBeenCalled();
    expect(portal.open).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/collection', 'tracking'], {
      queryParams: { item: 'omdb:tt1234567' },
    });
  });

  it('clears the item query param when the dialog closes', () => {
    component['onDialogClosed']();

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { item: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('validates user rating precision and range', () => {
    component['form'].userRate().value.set(8.5);
    expect(component['formErrors'].userRate.userRate()).toBe(false);
    expect(component['formErrors'].userRate.min()).toBe(false);
    expect(component['formErrors'].userRate.max()).toBe(false);

    component['form'].userRate().value.set(8.55);
    expect(component['formErrors'].userRate.userRate()).toBe(true);

    component['form'].userRate().value.set(-0.1);
    expect(component['formErrors'].userRate.min()).toBe(true);

    component['form'].userRate().value.set(10.1);
    expect(component['formErrors'].userRate.max()).toBe(true);
  });

  it('uses share code as library name when owner username is unavailable', () => {
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: null,
        grants: [],
      },
    ]);
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'owner-code' }));
    fixture.detectChanges();

    expect(component['library']()).toBe('owner-code');
  });

  it.each([
    [null, null, 'Fallback.NotAvailable'],
    [25, 100, '25 / 100'],
    [25, null, '25'],
    [null, 100, '100'],
  ] as const)('formats book progress %s of %s', (progressCurrent, progressTotal, expected) => {
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({
        listType: 'tracking',
        contentType: 'book',
        externalProvider: 'openlibrary',
        externalItemId: '9780306406157',
        IMDbId: undefined,
        progressCurrent,
        progressTotal,
      })
    );
    fixture.detectChanges();

    expect(component['bookProgressText']()).toBe(expected);
  });

  it('falls back to Open Library item ID when ISBN identity is unavailable', () => {
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({
        listType: 'books',
        contentType: 'book',
        externalProvider: 'openlibrary',
        externalItemId: '9780306406157',
        externalIds: [],
      })
    );
    fixture.detectChanges();

    expect(component['isbn']()).toBe('9780306406157');
  });

  it('omits IMDb link when item has no IMDb ID', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ IMDbId: undefined }));
    fixture.detectChanges();

    expect(component['imdbUrl']()).toBe('');
  });

  it('deletes tracking items with tracking list context', () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ listType: 'tracking', tags: [SERIES_TAG] }));
    fixture.detectChanges();

    component['onDelete']();

    expect(api.deleteByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', 'testhash', undefined, 'tracking');
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ listType: 'tracking' }),
      undefined,
      'tracking'
    );
  });

  it('leaves draft unchanged when read-only mode has no saved item', () => {
    component['onEdit']();
    component['form'].title().value.set('Draft');
    component['lastSavedItem'].set(null);

    component['onReadOnly']();

    expect(component['form'].title().value()).toBe('Draft');
    expect(component['editMode']()).toBe(false);
  });

  it('marks books completed with books source context', async () => {
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({
        listType: 'books',
        contentType: 'book',
        externalProvider: 'openlibrary',
        externalItemId: '9780306406157',
      })
    );
    fixture.detectChanges();

    await component['onMarkAsFinished']();

    expect(api.addCompletedItemByExternalId).toHaveBeenCalledWith('openlibrary', '9780306406157', undefined, 'books');
  });

  it('uses existing identities and keeps dialog closed when tracking match is absent', async () => {
    const externalIds = [{ source: 'imdb' as const, id: 'tt1234567' }];
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG], externalIds }));
    fixture.detectChanges();
    component['trackingExists'].set(true);

    await component['onOpenInTracking']();

    expect(api.getMatchedItems).toHaveBeenCalledWith({
      identities: externalIds,
      limit: 1,
      filters: { listType: 'tracking', shared: 'mine' },
    });
    expect(portal.open).not.toHaveBeenCalled();
  });

  it('does not remove tracking twin without its hash', async () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [SERIES_TAG] }));
    fixture.detectChanges();
    component['trackingExists'].set(true);

    await component['onRemoveFromTracking']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.deleteByExternalId).not.toHaveBeenCalled();
  });

  it('passes non-OMDb identity and applies saved metadata item updates', () => {
    const trackingItem = buildItem({
      listType: 'tracking',
      tags: [SERIES_TAG],
      externalProvider: 'openlibrary',
      externalItemId: '9780306406157',
    });
    fixture.componentRef.setInput('collectionItem', trackingItem);
    fixture.detectChanges();

    component['onManageSeriesMetadata']();
    const metadataInputs = portal.openStacked.mock.calls[0][1] as {
      externalProvider: string;
      externalItemId: string;
      saved: (seasons: Array<{ season: number; episodes: number }>, item?: CollectionItemModel) => void;
    };
    const updatedItem = buildItem({ ...trackingItem, title: 'Updated Series' });
    metadataInputs.saved([{ season: 1, episodes: 2 }], updatedItem);

    expect(metadataInputs).toEqual(
      expect.objectContaining({ externalProvider: 'openlibrary', externalItemId: '9780306406157' })
    );
    expect(component.collectionItem().title).toBe('Updated Series');
    expect(collectionService.updateCollectionItem).toHaveBeenCalled();
  });

  it('updates completed episodes without replacing item when dialog returns no item', () => {
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem({
        listType: 'tracking',
        tags: [SERIES_TAG],
        externalProvider: 'openlibrary',
        externalItemId: '9780306406157',
      })
    );
    fixture.detectChanges();

    component['onManageCompletedEpisodes']();
    const completedInputs = portal.openStacked.mock.calls[0][1] as {
      externalProvider: string;
      externalItemId: string;
      saved: (episodes: Array<{ season: number; episode: number }>, item?: CollectionItemModel) => void;
    };
    completedInputs.saved([{ season: 1, episode: 1 }]);

    expect(completedInputs).toEqual(
      expect.objectContaining({ externalProvider: 'openlibrary', externalItemId: '9780306406157' })
    );
    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
    expect(collectionService.updateCollectionItem).not.toHaveBeenCalled();
  });
});
