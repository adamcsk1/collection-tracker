import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { CollectionService } from '@client/collection/collection-service';
import {
  initialMainCollectionState,
  MainCollectionState,
  mainCollectionStateToken,
} from '@client/main/main-collection-store';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { EMPTY, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageRefreshService } from './image-refresh-service';

const buildItem = (overrides: Partial<CollectionItemModel> = {}): CollectionItemModel => ({
  rawContent: overrides.rawContent ?? 'content',
  rawContentLower: (overrides.rawContent ?? 'content').toLowerCase(),
  image: overrides.image ?? 'https://example.com/poster.jpg',
  title: overrides.title ?? 'Test Movie',
  titleLower: (overrides.title ?? 'Test Movie').toLowerCase(),
  genre: [],
  IMDbId: overrides.IMDbId ?? 'tt1234567',
  tags: overrides.tags ?? [],
  name: overrides.name ?? 'test-movie.md',
  year: overrides.year ?? 2020,
  rate: overrides.rate ?? '7.5',
});

describe('ImageRefreshService', () => {
  let service: ImageRefreshService;
  let collectionState: NgxSimpleSignalStoreService<MainCollectionState>;
  let httpClientGet: ReturnType<typeof vi.fn>;
  let api: { update: ReturnType<typeof vi.fn>; };
  let omdb: { getSelectedContent: ReturnType<typeof vi.fn>; };
  let collection: { loadCollection: ReturnType<typeof vi.fn>; };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn>; };

  beforeEach(() => {
    httpClientGet = vi.fn(() => of('ok'));
    api = { update: vi.fn(() => of(void 0)) };
    omdb = { getSelectedContent: vi.fn(() => of(null, null)) };
    collection = { loadCollection: vi.fn() };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      providers: [
        ImageRefreshService,
        { provide: HttpClient, useValue: { get: httpClientGet } },
        { provide: ApiService, useValue: api },
        { provide: OMDbService, useValue: omdb },
        { provide: CollectionService, useValue: collection },
        { provide: ConfirmService, useValue: confirm },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(ImageRefreshService);
    collectionState = TestBed.inject(mainCollectionStateToken);
  });

  it('does nothing when the user cancels the confirmation', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    collectionState.setState('collection', [buildItem()]);

    service.refreshImages();

    expect(httpClientGet).not.toHaveBeenCalled();
    expect(service.state().running).toBe(false);
  });

  it('sets running state and shows blocker when confirmed', () => {
    httpClientGet.mockReturnValue(EMPTY);
    collectionState.setState('collection', [buildItem(), buildItem()]);

    service.refreshImages();

    expect(service.state().running).toBe(true);
    expect(service.state().count).toBe(2);
    expect(TestBed.inject(blockerLoadingStateToken).state.show()).toBe(true);
  });

  it('shows success toast and loads collection when all images are valid', () => {
    collectionState.setState('collection', [buildItem()]);
    httpClientGet.mockReturnValue(of('ok'));
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    service.refreshImages();

    expect(collection.loadCollection).toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.ImagesRegenerated');
    expect(service.state().running).toBe(false);
  });

  it('hides blocker after processing completes', () => {
    collectionState.setState('collection', [buildItem()]);
    httpClientGet.mockReturnValue(of('ok'));

    service.refreshImages();

    expect(TestBed.inject(blockerLoadingStateToken).state.show()).toBe(false);
  });

  it('shows error toast with longer timeout when api update fails for an image', () => {
    const item = buildItem({ IMDbId: 'tt9876543', rawContent: 'content https://old.jpg' });
    collectionState.setState('collection', [item]);
    httpClientGet.mockReturnValue(throwError(() => new Error('image not found')));
    omdb.getSelectedContent = vi.fn(() => of(null, { imdbID: 'tt9876543', Poster: 'https://new.jpg' } as any));
    api.update = vi.fn(() => throwError(() => new Error('update failed')));
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    service.refreshImages();

    expect(toastState.state.message()).toBe('Toast.ImagesRegeneratedWithErrors');
    expect(toastState.state.timeout()).toBe(10000);
  });
});
