import { TestBed } from '@angular/core/testing';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  initialMainCollectionState,
  MainCollectionState,
  mainCollectionStateToken,
} from '../main/main-collection-store';
import { CollectionItemApiModel } from '@shared/models/api-model';
import { CollectionModel } from './collection-model';
import { CollectionService } from './collection-service';

describe('CollectionService', () => {
  let service: CollectionService;
  let mainCollectionState: NgxSimpleSignalStoreService<MainCollectionState>;

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CollectionService, provideStore(initialMainCollectionState, mainCollectionStateToken)],
    });

    service = TestBed.inject(CollectionService);
    mainCollectionState = TestBed.inject(mainCollectionStateToken);
  });

  it('increments reload trigger', () => {
    const initial = mainCollectionState.state.reloadTrigger();

    service.triggerReload();

    expect(mainCollectionState.state.reloadTrigger()).toBe(initial + 1);
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
