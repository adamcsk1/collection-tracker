import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CollectionService } from '../../collection-service';
import { NewItemDialogService } from './new-item-dialog-service';
import {
  initialSpinnerLoadingState,
  SpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ExternalMetadataService } from '@services/external-metadata/external-metadata-service';
import { ExternalMetadataItemModel } from '@shared/models/external-metadata-model';
import { SelectInputModel } from '@shared/models/select-model';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildSelectedContent = (overrides: Partial<ExternalMetadataItemModel> = {}): ExternalMetadataItemModel => ({
  provider: 'omdb',
  providerItemId: 'tt123',
  externalIds: [{ source: 'imdb', id: 'tt123' }],
  title: 'Title',
  year: '2020',
  contentType: 'movie',
  poster: 'poster-url',
  plot: 'Plot',
  actors: 'Actors',
  genres: ['Drama', 'Action'],
  ratings: [
    { source: 'Internet Movie Database', value: '9.0' },
    { source: 'Rotten Tomatoes', value: '96%' },
    { source: 'Metacritic', value: '85/100' },
  ],
  ...overrides,
});

const buildManualItem = () => ({
  title: 'Manual Title',
  IMDbId: 'tt1234567',
  year: '2020',
  rate: '8.5',
  rottenTomatoesRate: '95%',
  metacriticRate: '85/100',
  userRate: 9,
  image: 'image-url',
  genreText: 'Drama, Action',
  tagsText: '#tag1 tag2',
  actors: 'Actor One, Actor Two',
  plot: 'Plot text',
  contentType: 'movie' as const,
});

const createResponse = (item: object) => of({ item });

describe('NewItemDialogService', () => {
  let service: NewItemDialogService;
  let api: {
    create: ReturnType<typeof vi.fn>;
    addWatchedItemByExternalId: ReturnType<typeof vi.fn>;
    addTrackingItemByExternalId: ReturnType<typeof vi.fn>;
    markAllTrackingCompletedByExternalId: ReturnType<typeof vi.fn>;
  };
  let externalMetadata: {
    matchedContent: ReturnType<typeof signal<SelectInputModel>>;
    completedSearchText: ReturnType<typeof signal<string>>;
    getMatchedContents: ReturnType<typeof vi.fn>;
    getSelectedContent: ReturnType<typeof vi.fn>;
    getProviderReference: ReturnType<typeof vi.fn>;
  };
  let collection: { addCollectionItem: ReturnType<typeof vi.fn>; triggerReload: ReturnType<typeof vi.fn> };
  let spinnerStore: NgxSimpleSignalStoreService<SpinnerLoadingState>;
  let toastStore: NgxSimpleSignalStoreService<ToastState>;
  let portal: { closeAll: ReturnType<typeof vi.fn> };
  let translate: { translate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      create: vi.fn(),
      addWatchedItemByExternalId: vi.fn(() =>
        of({
          item: {
            title: 'Title',
            IMDbId: 'tt123',
            externalProvider: 'omdb',
            externalItemId: 'tt123',
            listType: 'finished',
          },
        })
      ),
      addTrackingItemByExternalId: vi.fn(() =>
        of({
          item: {
            title: 'Title',
            IMDbId: 'tt123',
            externalProvider: 'omdb',
            externalItemId: 'tt123',
            listType: 'tracking',
          },
        })
      ),
      markAllTrackingCompletedByExternalId: vi.fn(() =>
        of({
          item: {
            title: 'Title',
            IMDbId: 'tt123',
            externalProvider: 'omdb',
            externalItemId: 'tt123',
            listType: 'tracking',
            tags: ['#series', '#completed'],
          },
        })
      ),
    };
    externalMetadata = {
      matchedContent: signal<SelectInputModel>([]),
      completedSearchText: signal(''),
      getMatchedContents: vi.fn(),
      getSelectedContent: vi.fn(),
      getProviderReference: vi.fn(),
    };
    collection = { addCollectionItem: vi.fn(), triggerReload: vi.fn() };
    portal = { closeAll: vi.fn() };
    translate = { translate: vi.fn((key) => `t:${key}`) };

    TestBed.configureTestingModule({
      providers: [
        NewItemDialogService,
        { provide: ApiService, useValue: api },
        { provide: ExternalMetadataService, useValue: externalMetadata },
        { provide: CollectionService, useValue: collection },
        { provide: PortalService, useValue: portal },
        { provide: NgxSignalTranslateService, useValue: translate },
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(NewItemDialogService);
    spinnerStore = TestBed.inject(spinnerLoadingStateToken);
    toastStore = TestBed.inject(toastStateToken);
  });

  it('search triggers external metadata lookup and shows spinner', () => {
    service.search('matrix');

    expect(spinnerStore.state.show()).toBe(true);
    expect(externalMetadata.getMatchedContents).toHaveBeenCalledWith('matrix', null);
  });

  it('limits book searches to OpenLibrary', () => {
    service.search('dune', 'openlibrary');

    expect(externalMetadata.getMatchedContents).toHaveBeenCalledWith('dune', 'openlibrary');
  });

  it('saves OpenLibrary books without coercing their content type', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(
        null,
        buildSelectedContent({
          provider: 'openlibrary',
          providerItemId: 'isbn-9780441172719',
          externalIds: [{ source: 'isbn', id: '9780441172719' }],
          contentType: 'book',
        })
      ) as any
    );
    api.create.mockReturnValue(createResponse({ title: 'Title', listType: 'books' }));

    await firstValueFrom(service.save('openlibrary/isbn', null, '', 'close', { listType: 'books' }));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        externalProvider: 'openlibrary',
        contentType: 'book',
        externalIds: [{ source: 'isbn', id: '9780441172719' }],
      }),
      undefined,
      'books'
    );
  });

  it('returns typed provider references from external metadata', () => {
    externalMetadata.getProviderReference.mockReturnValue({ identitySource: 'omdb', identityId: 'tt123' });

    expect(service.getProviderReference('omdb/tt123')).toEqual({ identitySource: 'omdb', identityId: 'tt123' });
    expect(externalMetadata.getProviderReference).toHaveBeenCalledWith('omdb/tt123');
  });

  it('save persists selected content and closes when requested', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent()) as any);
    api.create.mockReturnValue(
      createResponse({ title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' })
    );

    await firstValueFrom(service.save('tt123', 8.7, '#tag', 'close'));

    expect(api.create).toHaveBeenCalledWith(
      {
        image: 'poster-url',
        title: 'Title',
        genre: ['Drama', 'Action'],
        IMDbId: 'tt123',
        externalProvider: 'omdb',
        externalItemId: 'tt123',
        externalIds: [{ source: 'imdb', id: 'tt123' }],
        tags: ['#tag'],
        year: '2020',
        rate: '9.0',
        rottenTomatoesRate: '96%',
        metacriticRate: '85/100',
        userRate: 8.7,
        actors: 'Actors',
        plot: 'Plot',
        contentType: 'movie',
        favorite: false,
      },
      undefined
    );
    expect(collection.addCollectionItem).toHaveBeenCalledWith(
      { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' },
      true
    );
    expect(collection.triggerReload).toHaveBeenCalled();
    expect(toastStore.state.message()).toBe('t:Toast.NewItem');
    expect(portal.closeAll).toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('saveManual persists manual item and closes when requested', async () => {
    api.create.mockReturnValue(
      createResponse({
        title: 'Manual Title',
        IMDbId: 'tt1234567',
        externalProvider: 'omdb',
        externalItemId: 'tt1234567',
      })
    );

    await firstValueFrom(service.saveManual(buildManualItem(), 'close'));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Manual Title',
        IMDbId: 'tt1234567',
        externalProvider: 'omdb',
        externalItemId: 'tt1234567',
        year: '2020',
        rate: '8.5',
        rottenTomatoesRate: '95%',
        metacriticRate: '85/100',
        userRate: 9,
        image: 'image-url',
        genre: ['Drama', 'Action'],
        tags: ['#tag1', 'tag2'],
        actors: 'Actor One, Actor Two',
        plot: 'Plot text',
        contentType: 'movie',
        favorite: false,
      }),
      undefined
    );
    expect(collection.addCollectionItem).toHaveBeenCalledWith(
      { title: 'Manual Title', IMDbId: 'tt1234567', externalProvider: 'omdb', externalItemId: 'tt1234567' },
      true
    );
    expect(collection.triggerReload).toHaveBeenCalled();
    expect(toastStore.state.message()).toBe('t:Toast.NewItem');
    expect(portal.closeAll).toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('saveManual does not call external metadata service', async () => {
    api.create.mockReturnValue(
      createResponse({
        title: 'Manual Title',
        IMDbId: 'tt1234567',
        externalProvider: 'omdb',
        externalItemId: 'tt1234567',
      })
    );

    await firstValueFrom(service.saveManual(buildManualItem(), 'close'));

    expect(externalMetadata.getSelectedContent).not.toHaveBeenCalled();
  });

  it('saveManual rejects non-series content for series tracker items', async () => {
    await expect(
      firstValueFrom(
        service.saveManual({ ...buildManualItem(), contentType: 'movie' }, 'close', { listType: 'tracking' })
      )
    ).rejects.toEqual(new Error('Tracking items must be series or books.'));

    expect(api.create).not.toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('saveManual rejects non-movie content for movie tracker items', async () => {
    await expect(
      firstValueFrom(
        service.saveManual({ ...buildManualItem(), contentType: 'series' }, 'close', { listType: 'finished' })
      )
    ).rejects.toEqual(new Error('Finished items must be movies or books.'));

    expect(api.create).not.toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('saveManual creates a movie tracker copy for watched library movies', async () => {
    api.create.mockReturnValue(
      createResponse({
        title: 'Manual Title',
        IMDbId: 'tt1234567',
        externalProvider: 'omdb',
        externalItemId: 'tt1234567',
      })
    );

    await firstValueFrom(service.saveManual(buildManualItem(), 'close', { watched: true }));

    expect(api.addWatchedItemByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', undefined);
  });

  it('saveManual finalizes the created item when the movie tracker update fails', async () => {
    const createdItem = {
      title: 'Manual Title',
      IMDbId: 'tt1234567',
      externalProvider: 'omdb',
      externalItemId: 'tt1234567',
    };
    api.create.mockReturnValue(createResponse(createdItem));
    api.addWatchedItemByExternalId.mockReturnValue(throwError(() => new Error('tracker failed')));

    await expect(firstValueFrom(service.saveManual(buildManualItem(), 'close', { watched: true }))).resolves.toEqual(
      createdItem
    );

    expect(collection.addCollectionItem).toHaveBeenCalledTimes(1);
    expect(collection.addCollectionItem).toHaveBeenCalledWith(createdItem, true);
    expect(collection.triggerReload).toHaveBeenCalled();
    expect(toastStore.state.message()).toBe('t:Toast.NewItemTrackerUpdateError');
    expect(portal.closeAll).toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('saveManual creates a series tracker copy for watched library series', async () => {
    api.create.mockReturnValue(
      createResponse({
        title: 'Manual Title',
        IMDbId: 'tt1234567',
        externalProvider: 'omdb',
        externalItemId: 'tt1234567',
      })
    );

    await firstValueFrom(
      service.saveManual({ ...buildManualItem(), contentType: 'series' }, 'close', {
        copyToTrackingAsWatched: true,
      })
    );

    expect(api.addTrackingItemByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567', undefined, undefined);
    expect(api.markAllTrackingCompletedByExternalId).toHaveBeenCalledWith('omdb', 'tt1234567');
  });

  it('saveManual finalizes the created item when marking the tracker series watched fails', async () => {
    const createdItem = {
      title: 'Manual Title',
      IMDbId: 'tt1234567',
      externalProvider: 'omdb',
      externalItemId: 'tt1234567',
    };
    api.create.mockReturnValue(createResponse(createdItem));
    api.markAllTrackingCompletedByExternalId.mockReturnValue(throwError(() => new Error('tracker failed')));

    await expect(
      firstValueFrom(
        service.saveManual({ ...buildManualItem(), contentType: 'series' }, 'close', {
          copyToTrackingAsWatched: true,
        })
      )
    ).resolves.toEqual(createdItem);

    expect(collection.addCollectionItem).toHaveBeenCalledTimes(1);
    expect(collection.addCollectionItem).toHaveBeenCalledWith(createdItem, true);
    expect(collection.triggerReload).toHaveBeenCalled();
    expect(toastStore.state.message()).toBe('t:Toast.NewItemTrackerUpdateError');
    expect(portal.closeAll).toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('saveManual stops spinner and rethrows on API error', async () => {
    api.create.mockReturnValue(throwError(() => new Error('fail')));

    await expect(firstValueFrom(service.saveManual(buildManualItem(), null))).rejects.toEqual(new Error('fail'));
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('normalizes selected IMDb ratings with /10 denominators before creating an item', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ ratings: [{ source: 'Internet Movie Database', value: '8.0/10' }] })) as any
    );
    api.create.mockReturnValue(createResponse({ title: 'Title', IMDbId: 'tt123' }));

    await firstValueFrom(service.save('tt123', null, '', 'close'));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ rate: '8.0' }), undefined);
  });

  it('creates a movie tracker copy when saving a watched library movie', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent()) as any);
    api.create.mockReturnValue(
      createResponse({ title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' })
    );

    await firstValueFrom(
      service.save('tt123', null, '', 'close', { targetOwnerShareCode: 'owner-code', watched: true })
    );

    expect(api.addWatchedItemByExternalId).toHaveBeenCalledWith('omdb', 'tt123', 'owner-code');
    expect(collection.addCollectionItem).toHaveBeenCalledWith(
      { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123', watched: true },
      true
    );
    expect(collection.addCollectionItem).toHaveBeenCalledWith(
      { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123', listType: 'finished' },
      true
    );
  });

  it('does not create a movie tracker copy when saving a watched library series', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ contentType: 'series' })) as any
    );
    api.create.mockReturnValue(createResponse({ title: 'Title', IMDbId: 'tt123', tags: ['#series'] }));

    await firstValueFrom(service.save('tt123', null, '', 'close', { watched: true }));

    expect(api.addWatchedItemByExternalId).not.toHaveBeenCalled();
  });

  it('save stops spinner and rethrows on API error', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent()) as any);
    api.create.mockReturnValue(throwError(() => new Error('fail')));

    await expect(firstValueFrom(service.save('tt123', null, '#tag', null))).rejects.toEqual(new Error('fail'));
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('saves watch later items with the watch later list type', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent()) as any);
    api.create.mockReturnValue(
      createResponse({ title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' })
    );

    await firstValueFrom(service.save('tt123', null, '#tag', 'close', { listType: 'watchlist' }));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['#tag'], contentType: 'movie' }),
      undefined,
      'watchlist'
    );
    expect(collection.addCollectionItem).toHaveBeenCalledWith(
      { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' },
      true
    );
    expect(collection.triggerReload).toHaveBeenCalled();
    expect(portal.closeAll).toHaveBeenCalled();
  });

  it('saves wishlist items with the wishlist list type', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent()) as any);
    api.create.mockReturnValue(
      createResponse({ title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' })
    );

    await firstValueFrom(service.save('tt123', null, '#tag', 'close', { listType: 'wishlist' }));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['#tag'], contentType: 'movie' }),
      undefined,
      'wishlist'
    );
  });

  it('saves series tracker items with the series tracker list type', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ contentType: 'series' })) as any
    );
    api.create.mockReturnValue(
      createResponse({ title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' })
    );

    await firstValueFrom(service.save('tt123', null, '#tag', 'close', { listType: 'tracking' }));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['#tag'], contentType: 'series' }),
      undefined,
      'tracking'
    );
  });

  it('saves manual items with the watch later list type', async () => {
    api.create.mockReturnValue(
      createResponse({
        title: 'Manual Title',
        IMDbId: 'tt1234567',
        externalProvider: 'omdb',
        externalItemId: 'tt1234567',
      })
    );

    await firstValueFrom(service.saveManual(buildManualItem(), 'close', { listType: 'watchlist' }));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'movie' }), undefined, 'watchlist');
  });

  it('saves manual items with the wishlist list type', async () => {
    api.create.mockReturnValue(
      createResponse({
        title: 'Manual Title',
        IMDbId: 'tt1234567',
        externalProvider: 'omdb',
        externalItemId: 'tt1234567',
      })
    );

    await firstValueFrom(service.saveManual(buildManualItem(), 'close', { listType: 'wishlist' }));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'movie' }), undefined, 'wishlist');
  });

  it('saves manual items with the series tracker list type', async () => {
    api.create.mockReturnValue(
      createResponse({
        title: 'Manual Title',
        IMDbId: 'tt1234567',
        externalProvider: 'omdb',
        externalItemId: 'tt1234567',
      })
    );

    await firstValueFrom(
      service.saveManual({ ...buildManualItem(), contentType: 'series' }, 'close', { listType: 'tracking' })
    );

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'series' }), undefined, 'tracking');
  });

  it('keeps year intervals from selected content', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent({ year: '2026-2028' })) as any);
    api.create.mockReturnValue(createResponse({ title: 'Title', IMDbId: 'tt123' }));

    await firstValueFrom(service.save('tt123', null, '', 'close'));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ year: '2026-2028' }), undefined);
  });

  it('keeps open year intervals from selected content', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent({ year: '2027–' })) as any);
    api.create.mockReturnValue(createResponse({ title: 'Title', IMDbId: 'tt123' }));

    await firstValueFrom(service.save('tt123', null, '', 'close'));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ year: '2027-' }), undefined);
  });

  it('normalizes decimal year artifacts from selected content', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent({ year: '2005.0' })) as any);
    api.create.mockReturnValue(createResponse({ title: 'Title', IMDbId: 'tt123' }));

    await firstValueFrom(service.save('tt123', null, '', 'close'));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ year: '2005' }), undefined);
  });

  it('rejects non-series content for series tracker items', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent()) as any);
    api.create.mockReturnValue(createResponse({ title: 'Title', IMDbId: 'tt123' }));

    await expect(firstValueFrom(service.save('tt123', null, '', 'close', { listType: 'tracking' }))).rejects.toEqual(
      new Error('Tracking items must be series or books.')
    );

    expect(api.create).not.toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('rejects non-movie content for movie tracker items', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ contentType: 'series' })) as any
    );
    api.create.mockReturnValue(createResponse({ title: 'Title', IMDbId: 'tt123' }));

    await expect(firstValueFrom(service.save('tt123', null, '', 'close', { listType: 'finished' }))).rejects.toEqual(
      new Error('Finished items must be movies or books.')
    );

    expect(api.create).not.toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('creates a series tracker copy and marks all watched when saving a library series with copy flag', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ contentType: 'series' })) as any
    );
    api.create.mockReturnValue(
      createResponse({ title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' })
    );

    await firstValueFrom(
      service.save('tt123', null, '', 'close', {
        targetOwnerShareCode: 'owner-code',
        copyToTrackingAsWatched: true,
      })
    );

    expect(api.addTrackingItemByExternalId).toHaveBeenCalledWith('omdb', 'tt123', undefined, 'owner-code');
    expect(api.markAllTrackingCompletedByExternalId).toHaveBeenCalledWith('omdb', 'tt123');
    expect(collection.addCollectionItem).toHaveBeenCalledWith(
      { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' },
      true
    );
    expect(collection.addCollectionItem).toHaveBeenCalledWith(
      {
        title: 'Title',
        IMDbId: 'tt123',
        externalProvider: 'omdb',
        externalItemId: 'tt123',
        listType: 'tracking',
        tags: ['#series', '#completed'],
      },
      true
    );
  });

  it('does not create a series tracker copy when copy flag is false', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ contentType: 'series' })) as any
    );
    api.create.mockReturnValue(createResponse({ title: 'Title', IMDbId: 'tt123' }));

    await firstValueFrom(service.save('tt123', null, '', 'close', {}));

    expect(api.addTrackingItemByExternalId).not.toHaveBeenCalled();
    expect(api.markAllTrackingCompletedByExternalId).not.toHaveBeenCalled();
  });

  it('ignores copy-to-watching flag for movies', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ contentType: 'movie' })) as any
    );
    api.create.mockReturnValue(createResponse({ title: 'Title', IMDbId: 'tt123' }));

    await firstValueFrom(service.save('tt123', null, '', 'close', { copyToTrackingAsWatched: true }));

    expect(api.addTrackingItemByExternalId).not.toHaveBeenCalled();
    expect(api.markAllTrackingCompletedByExternalId).not.toHaveBeenCalled();
  });

  it('ignores copy-to-watching flag for manual movies', async () => {
    api.create.mockReturnValue(
      createResponse({
        title: 'Manual Title',
        IMDbId: 'tt1234567',
        externalProvider: 'omdb',
        externalItemId: 'tt1234567',
      })
    );

    await firstValueFrom(service.saveManual(buildManualItem(), 'close', { copyToTrackingAsWatched: true }));

    expect(api.addTrackingItemByExternalId).not.toHaveBeenCalled();
    expect(api.markAllTrackingCompletedByExternalId).not.toHaveBeenCalled();
  });
});
