import { TestBed } from '@angular/core/testing';
import * as collectionUtils from './utils/get-collection-item-util';
import {
  initialMainCollectionState,
  MainCollectionState,
  mainCollectionStateToken,
} from '../main/main-collection-store';
import { ApiService } from '@services/api/api-service';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { GetAllApiResponseItemModel, GetAllApiResponseModel } from '@shared/models/api-model';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionModel } from './collection-model';
import { CollectionService } from './collection-service';

describe('CollectionService', () => {
  let service: CollectionService;
  let api: { getAll: ReturnType<typeof vi.fn> };
  let mainCollectionState: NgxSimpleSignalStoreService<MainCollectionState>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let getCollectionItemSpy: ReturnType<typeof vi.spyOn>;
  const originalStructuredClone = global.structuredClone;

  const buildCollectionItem = (name: string) => ({
    rawContent: `raw-${name}`,
    rawContentLower: `raw-${name}`.toLowerCase(),
    image: '',
    title: name,
    titleLower: name.toLowerCase(),
    genre: [],
    IMDbId: '',
    tags: [],
    name,
    year: null,
    rate: '',
    hash: '',
  });

  beforeEach(() => {
    api = { getAll: vi.fn() };
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
    getCollectionItemSpy = vi.spyOn(collectionUtils, 'getCollectionItem');
  });

  afterEach(() => {
    getCollectionItemSpy.mockRestore();
    (global as any).structuredClone = originalStructuredClone;
  });

  it('does not load collection when network status is pending', () => {
    apiState.setState('loadNetworkStatus', 'pending');

    service.loadCollection();

    expect(api.getAll).not.toHaveBeenCalled();
    expect(mainCollectionState.state.collection()).toEqual([]);
  });

  it('replaces collection with first batch then appends subsequent batches', () => {
    const subject = new Subject<GetAllApiResponseModel>();
    api.getAll.mockReturnValue(subject.asObservable());
    getCollectionItemSpy
      .mockImplementationOnce(() => buildCollectionItem('first'))
      .mockImplementationOnce(() => buildCollectionItem('second'));

    service.loadCollection();

    subject.next([{ name: 'first', content: 'first', hash: '' }]);
    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('first')]);

    subject.next([{ name: 'second', content: 'second', hash: '' }]);
    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('first'),
      buildCollectionItem('second'),
    ]);
    expect(getCollectionItemSpy).toHaveBeenCalledTimes(2);
  });

  it('adds a collection item to the front when first flag is true', () => {
    getCollectionItemSpy.mockImplementation((raw: GetAllApiResponseItemModel) => buildCollectionItem(raw.name));
    mainCollectionState.setState('collection', [buildCollectionItem('existing')]);

    service.addCollectionItem({ name: 'new', content: 'new', hash: '' }, true);

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('new'),
      buildCollectionItem('existing'),
    ]);
  });

  it('adds a collection item to the end when first flag is false', () => {
    getCollectionItemSpy.mockImplementation((raw: GetAllApiResponseItemModel) => buildCollectionItem(raw.name));
    mainCollectionState.setState('collection', [buildCollectionItem('existing')]);

    service.addCollectionItem({ name: 'another', content: 'another', hash: '' });

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('existing'),
      buildCollectionItem('another'),
    ]);
  });

  it('deletes a collection item by name', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('keep'), buildCollectionItem('remove')]);

    service.deleteCollectionItem('remove');

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('keep')]);
  });

  it('updates an existing collection item by name', () => {
    getCollectionItemSpy.mockImplementation(() => buildCollectionItem('updated'));
    mainCollectionState.setState('collection', [buildCollectionItem('target')]);

    service.updateCollectionItem('target', 'new content', 'newhash');

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('updated')]);
    expect(getCollectionItemSpy).toHaveBeenCalledWith({ name: 'target', content: 'new content', hash: 'newhash' });
  });
});
