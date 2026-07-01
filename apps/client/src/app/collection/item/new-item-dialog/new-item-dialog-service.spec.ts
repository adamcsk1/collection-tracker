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

describe('NewItemDialogService', () => {
  let service: NewItemDialogService;
  let api: {
    create: ReturnType<typeof vi.fn>;
    addMovieTrackerItemByExternalId: ReturnType<typeof vi.fn>;
    addSeriesTrackerItemByExternalId: ReturnType<typeof vi.fn>;
    markAllSeriesTrackerWatchedByExternalId: ReturnType<typeof vi.fn>;
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
      addMovieTrackerItemByExternalId: vi.fn(() =>
        of({
          item: {
            title: 'Title',
            IMDbId: 'tt123',
            externalProvider: 'omdb',
            externalItemId: 'tt123',
            listType: 'movie-tracker',
          },
        })
      ),
      addSeriesTrackerItemByExternalId: vi.fn(() =>
        of({
          item: {
            title: 'Title',
            IMDbId: 'tt123',
            externalProvider: 'omdb',
            externalItemId: 'tt123',
            listType: 'series-tracker',
          },
        })
      ),
      markAllSeriesTrackerWatchedByExternalId: vi.fn(() =>
        of({
          item: {
            title: 'Title',
            IMDbId: 'tt123',
            externalProvider: 'omdb',
            externalItemId: 'tt123',
            listType: 'series-tracker',
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
    expect(externalMetadata.getMatchedContents).toHaveBeenCalledWith('matrix');
  });

  it('returns typed provider references from external metadata', () => {
    externalMetadata.getProviderReference.mockReturnValue({ identitySource: 'omdb', identityId: 'tt123' });

    expect(service.getProviderReference('omdb/tt123')).toEqual({ identitySource: 'omdb', identityId: 'tt123' });
    expect(externalMetadata.getProviderReference).toHaveBeenCalledWith('omdb/tt123');
  });

  it('save persists selected content and closes when requested', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(
      of({ item: { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' } })
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

  it('normalizes selected IMDb ratings with /10 denominators before creating an item', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ ratings: [{ source: 'Internet Movie Database', value: '8.0/10' }] }) as any)
    );
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '', 'close'));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ rate: '8.0' }), undefined);
  });

  it('creates a movie tracker copy when saving a watched library movie', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(
      of({ item: { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' } })
    );

    await firstValueFrom(
      service.save('tt123', null, '', 'close', { targetOwnerShareCode: 'owner-code', watched: true })
    );

    expect(api.addMovieTrackerItemByExternalId).toHaveBeenCalledWith('omdb', 'tt123', 'owner-code');
    expect(collection.addCollectionItem).toHaveBeenCalledWith(
      { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123', watched: true },
      true
    );
    expect(collection.addCollectionItem).toHaveBeenCalledWith(
      { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123', listType: 'movie-tracker' },
      true
    );
  });

  it('does not create a movie tracker copy when saving a watched library series', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ contentType: 'series' }) as any)
    );
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123', tags: ['#series'] } }));

    await firstValueFrom(service.save('tt123', null, '', 'close', { watched: true }));

    expect(api.addMovieTrackerItemByExternalId).not.toHaveBeenCalled();
  });

  it('save stops spinner and rethrows on API error', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(throwError(() => new Error('fail')));

    await expect(firstValueFrom(service.save('tt123', null, '#tag', null))).rejects.toEqual(new Error('fail'));
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('saves watch later items with the watch later list type', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(
      of({ item: { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' } })
    );

    await firstValueFrom(service.save('tt123', null, '#tag', 'close', { listType: 'watch-later' }));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['#tag'], contentType: 'movie' }),
      undefined,
      'watch-later'
    );
    expect(collection.addCollectionItem).toHaveBeenCalledWith(
      { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' },
      true
    );
    expect(collection.triggerReload).toHaveBeenCalled();
    expect(portal.closeAll).toHaveBeenCalled();
  });

  it('saves wishlist items with the wishlist list type', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(
      of({ item: { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' } })
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
      of(null, buildSelectedContent({ contentType: 'series' }) as any)
    );
    api.create.mockReturnValue(
      of({ item: { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' } })
    );

    await firstValueFrom(service.save('tt123', null, '#tag', 'close', { listType: 'series-tracker' }));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['#tag'], contentType: 'series' }),
      undefined,
      'series-tracker'
    );
  });

  it('keeps year intervals from selected content', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent({ year: '2026-2028' }) as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '', 'close'));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ year: '2026-2028' }), undefined);
  });

  it('keeps open year intervals from selected content', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent({ year: '2027–' }) as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '', 'close'));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ year: '2027-' }), undefined);
  });

  it('normalizes decimal year artifacts from selected content', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent({ year: '2005.0' }) as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '', 'close'));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ year: '2005' }), undefined);
  });

  it('rejects non-series content for series tracker items', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await expect(
      firstValueFrom(service.save('tt123', null, '', 'close', { listType: 'series-tracker' }))
    ).rejects.toEqual(new Error('Series tracker items must be series.'));

    expect(api.create).not.toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('creates a series tracker copy and marks all watched when saving a library series with copy flag', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ contentType: 'series' }) as any)
    );
    api.create.mockReturnValue(
      of({ item: { title: 'Title', IMDbId: 'tt123', externalProvider: 'omdb', externalItemId: 'tt123' } })
    );

    await firstValueFrom(
      service.save('tt123', null, '', 'close', {
        targetOwnerShareCode: 'owner-code',
        copyToSeriesTrackerAsWatched: true,
      })
    );

    expect(api.addSeriesTrackerItemByExternalId).toHaveBeenCalledWith('omdb', 'tt123', undefined, 'owner-code');
    expect(api.markAllSeriesTrackerWatchedByExternalId).toHaveBeenCalledWith('omdb', 'tt123');
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
        listType: 'series-tracker',
        tags: ['#series', '#completed'],
      },
      true
    );
  });

  it('does not create a series tracker copy when copy flag is false', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ contentType: 'series' }) as any)
    );
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '', 'close', {}));

    expect(api.addSeriesTrackerItemByExternalId).not.toHaveBeenCalled();
    expect(api.markAllSeriesTrackerWatchedByExternalId).not.toHaveBeenCalled();
  });

  it('ignores copy-to-series-tracker flag for movies', async () => {
    externalMetadata.getSelectedContent.mockReturnValue(
      of(null, buildSelectedContent({ contentType: 'movie' }) as any)
    );
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '', 'close', { copyToSeriesTrackerAsWatched: true }));

    expect(api.addSeriesTrackerItemByExternalId).not.toHaveBeenCalled();
    expect(api.markAllSeriesTrackerWatchedByExternalId).not.toHaveBeenCalled();
  });
});
