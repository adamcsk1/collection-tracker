import { TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { CollectionItemApiModel, CollectionItemsApiResponseModel } from '@shared/models/api-model';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initialMainCollectionState,
  MainCollectionState,
  mainCollectionStateToken,
} from '../main/main-collection-store';
import { CollectionModel } from './collection-model';
import { CollectionService } from './collection-service';

describe('CollectionService', () => {
  let service: CollectionService;
  let api: { searchItems: ReturnType<typeof vi.fn> };
  let mainCollectionState: NgxSimpleSignalStoreService<MainCollectionState>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  const originalStructuredClone = global.structuredClone;

  const buildCollectionItem = (title: string): CollectionItemApiModel => ({
    image: '',
    title,
    titleLower: title.toLowerCase(),
    searchableTextLower: title.toLowerCase(),
    genre: [],
    IMDbId: `tt-${title}`,
    tags: [],
    year: null,
    rate: '',
    hash: '',
    actors: '',
    plot: '',
  });

  const buildResponse = (items: CollectionItemApiModel[]): CollectionItemsApiResponseModel => ({
    items,
    total: items.length,
    offset: 0,
    limit: 100,
  });

  beforeEach(() => {
    api = { searchItems: vi.fn() };
    (global as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value));
    TestBed.configureTestingModule({
      providers: [
        CollectionService,
        { provide: ApiService, useValue: api },
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialApiState, apiStateToken),
      ],
    });

    service = TestBed.inject(CollectionService);
    mainCollectionState = TestBed.inject(mainCollectionStateToken);
    apiState = TestBed.inject(apiStateToken);
  });

  afterEach(() => {
    (global as any).structuredClone = originalStructuredClone;
  });

  it('does not load collection when network status is pending', () => {
    apiState.setState('loadNetworkStatus', 'pending');

    service.loadCollection();

    expect(api.searchItems).not.toHaveBeenCalled();
    expect(mainCollectionState.state.collection()).toEqual([]);
  });

  it('replaces collection with first batch then appends subsequent batches', () => {
    const subject = new Subject<CollectionItemsApiResponseModel>();
    api.searchItems.mockReturnValue(subject.asObservable());
    service.loadCollection();

    subject.next(buildResponse([buildCollectionItem('first')]));
    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('first')]);

    subject.next(buildResponse([buildCollectionItem('second')]));
    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('first'),
      buildCollectionItem('second'),
    ]);
  });

  it('adds a collection item to the front when first flag is true', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('existing')]);

    service.addCollectionItem(buildCollectionItem('new'), true);

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('new'),
      buildCollectionItem('existing'),
    ]);
  });

  it('adds a collection item to the end when first flag is false', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('existing')]);

    service.addCollectionItem(buildCollectionItem('another'));

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('existing'),
      buildCollectionItem('another'),
    ]);
  });

  it('deletes a collection item by name', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('keep'), buildCollectionItem('remove')]);

    service.deleteCollectionItem('tt-remove');

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('keep')]);
  });

  it('updates an existing collection item by name', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('target')]);

    service.updateCollectionItem('tt-target', buildCollectionItem('updated'));

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('updated')]);
  });
});
