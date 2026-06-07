import { TestBed } from '@angular/core/testing';
import { CollectionService } from '../collection-service';
import { NewItemDialogService } from './new-item-dialog-service';
import {
  initialSpinnerLoadingState,
  SpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildSelectedContent = (overrides: Partial<ReturnType<typeof buildSelectedContent>> = {}) => ({
  Title: 'Title',
  Year: '2020',
  imdbID: 'tt123',
  imdbRating: '9.0',
  Ratings: [
    { Source: 'Internet Movie Database', Value: '9.0/10' },
    { Source: 'Rotten Tomatoes', Value: '96%' },
    { Source: 'Metacritic', Value: '85/100' },
  ],
  Plot: 'Plot',
  Poster: 'poster-url',
  Director: 'Director',
  Genre: 'Drama, Action',
  Actors: 'Actors',
  Type: 'movie',
  ...overrides,
});

describe('NewItemDialogService', () => {
  let service: NewItemDialogService;
  let api: { create: ReturnType<typeof vi.fn> };
  let omdb: {
    matchedContent: ReturnType<typeof vi.fn>;
    getMatchedContents: ReturnType<typeof vi.fn>;
    getSelectedContent: ReturnType<typeof vi.fn>;
  };
  let collection: { addCollectionItem: ReturnType<typeof vi.fn>; triggerReload: ReturnType<typeof vi.fn> };
  let spinnerStore: NgxSimpleSignalStoreService<SpinnerLoadingState>;
  let toastStore: NgxSimpleSignalStoreService<ToastState>;
  let portal: { close: ReturnType<typeof vi.fn> };
  let translate: { translate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { create: vi.fn() };
    omdb = { matchedContent: vi.fn(() => []), getMatchedContents: vi.fn(), getSelectedContent: vi.fn() };
    collection = { addCollectionItem: vi.fn(), triggerReload: vi.fn() };
    portal = { close: vi.fn() };
    translate = { translate: vi.fn((key) => `t:${key}`) };

    TestBed.configureTestingModule({
      providers: [
        NewItemDialogService,
        { provide: ApiService, useValue: api },
        { provide: OMDbService, useValue: omdb },
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

  it('search triggers OMDb lookup and shows spinner', () => {
    service.search('matrix');

    expect(spinnerStore.state.show()).toBe(true);
    expect(omdb.getMatchedContents).toHaveBeenCalledWith('matrix');
  });

  it('save persists selected content and closes when requested', async () => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', 8.7, '#tag', 'close'));

    expect(api.create).toHaveBeenCalledWith(
      {
        image: 'poster-url',
        title: 'Title',
        genre: ['Drama', 'Action'],
        IMDbId: 'tt123',
        tags: ['#movie', '#tag'],
        year: '2020',
        rate: '9.0',
        rottenTomatoesRate: '96%',
        metacriticRate: '85/100',
        userRate: 8.7,
        actors: 'Actors',
        plot: 'Plot',
      },
      undefined
    );
    expect(collection.addCollectionItem).toHaveBeenCalledWith({ title: 'Title', IMDbId: 'tt123' }, true);
    expect(collection.triggerReload).toHaveBeenCalled();
    expect(toastStore.state.message()).toBe('t:Toast.NewItem');
    expect(portal.close).toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('save stops spinner and rethrows on API error', async () => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(throwError(() => new Error('fail')));

    await expect(firstValueFrom(service.save('tt123', null, '#tag', null))).rejects.toEqual(new Error('fail'));
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('saves watch later items with the watch later list type', async () => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '#tag', 'close', undefined, 'watch-later'));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['#movie', '#tag'] }),
      undefined,
      'watch-later',
      undefined
    );
  });

  it('saves wishlist items with the wishlist list type', async () => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '#tag', 'close', undefined, 'wishlist'));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['#movie', '#tag'] }),
      undefined,
      'wishlist',
      undefined
    );
  });

  it('saves series tracker items with the series tracker list type', async () => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent({ Type: 'series' }) as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '#tag', 'close', undefined, 'series-tracker', true));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['#series', '#tag'] }),
      undefined,
      'series-tracker',
      true
    );
  });

  it('keeps year intervals from selected content', async () => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent({ Year: '2026-2028' }) as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '', 'close'));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ year: '2026-2028' }), undefined);
  });

  it('keeps open year intervals from selected content', async () => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent({ Year: '2027–' }) as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '', 'close'));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ year: '2027-' }), undefined);
  });

  it('normalizes decimal year artifacts from selected content', async () => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent({ Year: '2005.0' }) as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await firstValueFrom(service.save('tt123', null, '', 'close'));

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ year: '2005' }), undefined);
  });

  it('rejects non-series content for series tracker items', async () => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(of({ item: { title: 'Title', IMDbId: 'tt123' } }));

    await expect(firstValueFrom(service.save('tt123', null, '', 'close', undefined, 'series-tracker'))).rejects.toEqual(
      new Error('Series tracker items must be series.')
    );

    expect(api.create).not.toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });
});
