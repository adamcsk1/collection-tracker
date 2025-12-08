import { TestBed } from '@angular/core/testing';
import * as collectionUtils from '@client/collection/utils/get-collection-item-util';
import { initialMainCollectionState, mainCollectionStateToken } from '@client/main/main-collection-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { GetAllApiResponseItemModel, GetAllApiResponseModel } from '@shared/models/api-model';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { Subject } from 'rxjs';
import { CollectionModel } from './collection-model';
import { CollectionService } from './collection-service';

describe('CollectionService', () => {
  let service: CollectionService;
  let api: { getAll: jest.Mock };
  let mainCollectionState: NgxSimpleSignalStoreService<typeof initialMainCollectionState>;
  let apiState: NgxSimpleSignalStoreService<typeof initialApiState>;
  let getCollectionItemSpy: jest.SpyInstance;
  const originalStructuredClone = global.structuredClone;

  const buildCollectionItem = (name: string) => ({
    rawContent: `raw-${name}`,
    image: '',
    title: name,
    genre: [],
    IMDbId: '',
    tags: [],
    name,
    year: null,
    rate: '',
  });

  beforeEach(() => {
    api = { getAll: jest.fn() };
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
    mainCollectionState = TestBed.inject(mainCollectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialMainCollectionState
    >;
    apiState = TestBed.inject(apiStateToken) as NgxSimpleSignalStoreService<typeof initialApiState>;
    getCollectionItemSpy = jest.spyOn(collectionUtils, 'getCollectionItem');
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

    subject.next([{ name: 'first', content: 'first' }]);
    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('first')]);

    subject.next([{ name: 'second', content: 'second' }]);
    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('first'),
      buildCollectionItem('second'),
    ]);
    expect(getCollectionItemSpy).toHaveBeenCalledTimes(2);
  });

  it('adds a collection item to the front when first flag is true', () => {
    getCollectionItemSpy.mockImplementation((raw) => buildCollectionItem(raw.name as string));
    mainCollectionState.setState('collection', [buildCollectionItem('existing')]);

    service.addCollectionItem({ name: 'new', content: 'new' } as GetAllApiResponseItemModel, true);

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('new'),
      buildCollectionItem('existing'),
    ]);
  });

  it('adds a collection item to the end when first flag is false', () => {
    getCollectionItemSpy.mockImplementation((raw) => buildCollectionItem(raw.name as string));
    mainCollectionState.setState('collection', [buildCollectionItem('existing')]);

    service.addCollectionItem({ name: 'another', content: 'another' } as GetAllApiResponseItemModel);

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

    service.updateCollectionItem('target', 'new content');

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('updated')]);
    expect(getCollectionItemSpy).toHaveBeenCalledWith({ name: 'target', content: 'new content' });
  });
});
